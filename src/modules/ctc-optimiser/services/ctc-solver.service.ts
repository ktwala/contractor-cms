import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PackRouterService, RoutingResult } from '../../../country-packs/services/pack-router.service';
import { CtcScenarioGeneratorService } from './ctc-scenario-generator.service';
import { CtcConstraintService } from './ctc-constraint.service';
import { CtcScenarioEvaluatorService } from './ctc-scenario-evaluator.service';
import { CtcScenarioRankerService } from './ctc-scenario-ranker.service';
import { CtcExplanationService } from './ctc-explanation.service';
import { CtcVariableSpaceBuilder } from './ctc-variable-space.builder';
import { CtcResponseMapper } from './ctc-response.mapper';
import { RunSimpleCtcOptimiserDto } from '../dto/run-simple-ctc-optimiser.dto';
import { CTC_AUDIT_EVENTS, CTC_BLOCKED_CODES } from '../domain/ctc-optimiser.constants';
import { CtcEvaluatedScenario, SimpleCtcOptimiserResponse } from '../domain/ctc-optimiser.types';

/**
 * Simplified solver orchestration: takes user goals + policy toggles,
 * derives the variable space, generates candidates, evaluates through
 * the real payroll engine, and returns advisory recommendations.
 */
@Injectable()
export class CtcSolverService {
  private readonly logger = new Logger(CtcSolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly packRouterService: PackRouterService,
    private readonly variableSpaceBuilder: CtcVariableSpaceBuilder,
    private readonly generator: CtcScenarioGeneratorService,
    private readonly constraintService: CtcConstraintService,
    private readonly evaluator: CtcScenarioEvaluatorService,
    private readonly ranker: CtcScenarioRankerService,
    private readonly explanationService: CtcExplanationService,
    private readonly responseMapper: CtcResponseMapper,
  ) {}

  async solve(
    dto: RunSimpleCtcOptimiserDto,
    userId: string,
    tenantId: string,
  ): Promise<SimpleCtcOptimiserResponse> {
    const fullDto = this.variableSpaceBuilder.toFullDto(dto);

    let routing: RoutingResult;
    try {
      routing = await this.packRouterService.resolveRouting({
        country: dto.countryCode as 'LS' | 'ZA',
        legal_entity_id: dto.legalEntityId ?? '',
        pay_date: new Date().toISOString(),
        period_end: new Date().toISOString(),
        run_type: 'REGULAR',
      });
    } catch (error) {
      this.logger.error(`Pack routing failed for ${dto.countryCode}`, error);
      throw new BadRequestException({
        code: CTC_BLOCKED_CODES.COUNTRY_PACK_NOT_FOUND,
        message: `No active compute pack found for ${dto.countryCode}. Ensure country packs and tax tables are seeded.`,
      });
    }

    const run = await this.prisma.ctcOptimiserRun.create({
      data: {
        tenantId,
        legalEntityId: dto.legalEntityId,
        employeeId: dto.employeeId,
        countryCode: dto.countryCode,
        taxYear: dto.taxYear,
        payFrequency: dto.payFrequency,
        optimisationMode: dto.optimisationMode,
        inputJson: dto as any,
        routingJson: routing as any,
        assumptionsJson: {
          generatedAt: new Date().toISOString(),
          routingVersion: routing.pack.version,
          packId: routing.pack.id,
          taxTableSetId: routing.tax_tables.paye_table_set_id,
          solver: 'simple',
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
        countryCode: dto.countryCode,
        ctc: dto.packageInput.ctc,
        optimisationMode: dto.optimisationMode,
        packVersion: routing.pack.version,
        solver: 'simple',
      } as any,
    });

    const rawScenarios = this.generator.generate(fullDto);
    this.logger.log(`Solver generated ${rawScenarios.length} candidates for run ${run.id}`);

    const evaluated: CtcEvaluatedScenario[] = [];
    for (const scenario of rawScenarios) {
      const policy = this.constraintService.validate(fullDto, scenario);
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
        const evaluation = await this.evaluator.evaluate({
          input: fullDto,
          scenario,
          routing,
        });
        const explanations = this.explanationService.explainScenario({
          input: fullDto,
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

    const ranked = this.ranker.rank(fullDto, evaluated);

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

    return this.responseMapper.mapToAdvisoryResponse(
      run.id,
      dto.optimisationMode,
      dto.packageInput.ctc,
      dto.packageInput.targetNet,
      ranked,
      dto.packageInput.medicalFundingModel ?? 'EMPLOYER_FUNDED',
      dto.packageInput.medicalAidAmount,
    );
  }
}
