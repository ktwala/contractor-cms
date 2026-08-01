import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PackRouterService, RoutingResult } from '../../country-packs/services/pack-router.service';
import { CtcScenarioGeneratorService } from './services/ctc-scenario-generator.service';
import { CtcConstraintService } from './services/ctc-constraint.service';
import { CtcScenarioEvaluatorService } from './services/ctc-scenario-evaluator.service';
import { CtcScenarioRankerService } from './services/ctc-scenario-ranker.service';
import { CtcExplanationService } from './services/ctc-explanation.service';
import { RunCtcOptimiserDto } from './dto/run-ctc-optimiser.dto';
import { ApplyCtcScenarioDto } from './dto/apply-ctc-scenario.dto';
import { CTC_AUDIT_EVENTS, CTC_BLOCKED_CODES } from './domain/ctc-optimiser.constants';
import { CtcEvaluatedScenario } from './domain/ctc-optimiser.types';

@Injectable()
export class CtcOptimiserService {
  private readonly logger = new Logger(CtcOptimiserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly packRouterService: PackRouterService,
    private readonly generator: CtcScenarioGeneratorService,
    private readonly constraintService: CtcConstraintService,
    private readonly evaluator: CtcScenarioEvaluatorService,
    private readonly ranker: CtcScenarioRankerService,
    private readonly explanationService: CtcExplanationService,
  ) {}

  async runOptimisation(input: RunCtcOptimiserDto, userId: string, tenantId: string) {
    let routing: RoutingResult;
    try {
      routing = await this.packRouterService.resolveRouting({
        country: input.countryCode as 'LS' | 'ZA',
        legal_entity_id: input.legalEntityId ?? '',
        pay_date: new Date().toISOString(),
        period_end: new Date().toISOString(),
        run_type: 'REGULAR',
      });
    } catch (error) {
      this.logger.error(`Pack routing failed for ${input.countryCode}`, error);
      throw new BadRequestException({
        code: CTC_BLOCKED_CODES.COUNTRY_PACK_NOT_FOUND,
        message: `No active compute pack found for ${input.countryCode}. Ensure country packs and tax tables are seeded.`,
      });
    }

    const run = await this.prisma.ctcOptimiserRun.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        employeeId: input.employeeId,
        countryCode: input.countryCode,
        taxYear: input.taxYear,
        payFrequency: input.payFrequency,
        optimisationMode: input.optimisationMode,
        inputJson: input as any,
        routingJson: routing as any,
        assumptionsJson: {
          generatedAt: new Date().toISOString(),
          routingVersion: routing.pack.version,
          packId: routing.pack.id,
          taxTableSetId: routing.tax_tables.paye_table_set_id,
        },
        createdByUserId: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: CTC_AUDIT_EVENTS.RUN,
      entityType: 'CtcOptimiserRun',
      entityId: run.id,
      newValue: {
        countryCode: input.countryCode,
        ctc: input.ctc,
        optimisationMode: input.optimisationMode,
        packVersion: routing.pack.version,
      } as any,
    });

    const rawScenarios = this.generator.generate(input);
    this.logger.log(`Generated ${rawScenarios.length} candidate scenarios for run ${run.id}`);

    const evaluated: CtcEvaluatedScenario[] = [];
    for (const scenario of rawScenarios) {
      const policy = this.constraintService.validate(input, scenario);
      if (policy.status === 'BLOCK') {
        evaluated.push({
          scenario,
          policy,
          evaluation: null,
          explanations: this.explanationService.explainBlockedScenario(policy),
          warnings: policy.warnings,
          score: null,
        });
        continue;
      }

      try {
        const evaluation = await this.evaluator.evaluate({ input, scenario, routing });
        const explanations = this.explanationService.explainScenario({
          input,
          scenario,
          evaluation,
          policy,
        });
        evaluated.push({
          scenario,
          policy,
          evaluation,
          explanations,
          warnings: policy.warnings,
        });
      } catch (error) {
        this.logger.warn(`Scenario evaluation failed: ${error.message}`);
        evaluated.push({
          scenario,
          policy,
          evaluation: null,
          explanations: [`Evaluation failed: ${error.message}`],
          warnings: policy.warnings,
          score: null,
        });
      }
    }

    const ranked = this.ranker.rank(input, evaluated);

    for (let i = 0; i < ranked.length; i += 1) {
      const item = ranked[i];
      await this.prisma.ctcOptimiserScenario.create({
        data: {
          runId: run.id,
          scenarioCode: `SCN-${String(i + 1).padStart(3, '0')}`,
          rank: item.rank ?? null,
          isValid: item.policy.status !== 'BLOCK',
          policyStatus: item.policy.status,
          inputBreakdownJson: item.scenario as any,
          payrollOutputJson: (item.evaluation ?? {}) as any,
          explanationsJson: item.explanations as any,
          warningsJson: item.warnings as any,
          scoreTotal: item.score?.totalScore ?? null,
          scoreBreakdownJson: (item.score ?? null) as any,
          checksum: item.checksum ?? null,
        },
      });
    }

    return this.getRun(run.id);
  }

  async getRun(id: string) {
    const run = await this.prisma.ctcOptimiserRun.findUnique({
      where: { id },
      include: {
        scenarios: {
          orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
        },
        decisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Optimiser run ${id} not found`);
    }

    return run;
  }

  async applyScenario(dto: ApplyCtcScenarioDto, userId: string, tenantId: string) {
    const scenario = await this.prisma.ctcOptimiserScenario.findUnique({
      where: { id: dto.scenarioId },
      include: { run: true },
    });

    if (!scenario) {
      throw new NotFoundException('Scenario not found');
    }

    if (scenario.runId !== dto.runId) {
      throw new BadRequestException('Scenario does not belong to the specified run');
    }

    if (scenario.run.tenantId !== tenantId) {
      throw new BadRequestException('Run does not belong to the current tenant');
    }

    if (!scenario.isValid) {
      throw new BadRequestException('Cannot apply a blocked scenario');
    }

    if (scenario.run.status === 'APPLIED') {
      throw new BadRequestException('This run has already been applied');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ctcOptimiserDecision.create({
        data: {
          runId: scenario.runId,
          scenarioId: scenario.id,
          decisionType: 'APPLY',
          decisionStatus: 'APPLIED',
          decidedByUserId: userId,
          notes: dto.notes,
          decidedAt: new Date(),
        },
      });

      await tx.ctcOptimiserRun.update({
        where: { id: scenario.runId },
        data: {
          selectedScenarioId: scenario.id,
          status: 'APPLIED',
          appliedByUserId: userId,
          appliedAt: new Date(),
        },
      });
    });

    await this.auditService.log({
      userId,
      action: CTC_AUDIT_EVENTS.APPLIED,
      entityType: 'CtcOptimiserRun',
      entityId: scenario.runId,
      newValue: {
        scenarioId: scenario.id,
        scenarioCode: scenario.scenarioCode,
        notes: dto.notes,
        tenantId,
      } as any,
    });

    return { success: true, runId: scenario.runId, scenarioId: scenario.id };
  }
}
