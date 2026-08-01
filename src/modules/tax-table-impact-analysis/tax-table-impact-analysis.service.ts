import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { TtaException } from '../tax-table-authoring/types/error-codes';
import { TaxTableImpactAnalysisBasisService } from './tax-table-impact-analysis-basis.service';
import { TaxTableImpactAnalysisSummaryService } from './tax-table-impact-analysis-summary.service';
import { TaxTableImpactAnalysisMapper } from './tax-table-impact-analysis.mapper';
import { TaxTableImpactAnalysisRunRepository } from './tax-table-impact-analysis-run.repository';
import { assertImpactAnalysisAllowed } from './tax-table-impact-analysis.policy';
import type { RunImpactAnalysisDto } from './dto/run-impact-analysis.dto';
import type {
  ImpactAnalysisPerEmployeeResult,
  NormalizedRuntimeTaxTable,
} from './types/tax-table-impact-analysis.types';

@Injectable()
export class TaxTableImpactAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly basisService: TaxTableImpactAnalysisBasisService,
    private readonly summaryService: TaxTableImpactAnalysisSummaryService,
    private readonly mapper: TaxTableImpactAnalysisMapper,
    private readonly runRepository: TaxTableImpactAnalysisRunRepository,
  ) {}

  async run(dto: RunImpactAnalysisDto, actorUserId = 'system') {
    const authoring = await this.loadAuthoringVersion(dto.authoringVersionId);

    assertImpactAnalysisAllowed({
      authoringStatus: authoring.status,
      countryCode: authoring.countryCode,
    });

    if (authoring.countryCode !== dto.countryCode) {
      throw new TtaException(
        'TTA_IMPACT_COUNTRY_MISMATCH',
        `Draft country (${authoring.countryCode}) does not match request country (${dto.countryCode})`,
        undefined,
        400,
      );
    }

    const draftTable = this.mapper.mapAuthoringToNormalizedDraft(authoring);
    const runtimeTable = await this.loadActiveRuntimeTable(dto.countryCode, authoring.tableType);
    const basisRows = await this.basisService.loadBasis(dto);

    const draftTaxCtx = this.mapper.buildTaxTableContext('draft', null, draftTable);
    const baselineTaxCtx = runtimeTable
      ? this.mapper.buildTaxTableContext('runtime', runtimeTable, null)
      : draftTaxCtx;

    const results: ImpactAnalysisPerEmployeeResult[] = [];
    const warnings = new Set<string>();
    let skipped = 0;

    if (!runtimeTable) {
      warnings.add('No active runtime table found — baseline will match draft (no delta expected)');
    }

    for (const basis of basisRows) {
      try {
        const baseline = this.mapper.computePaye(basis, baselineTaxCtx);
        const draft = this.mapper.computePaye(basis, draftTaxCtx);

        baseline.warnings.forEach((w) => warnings.add(w));
        draft.warnings.forEach((w) => warnings.add(w));

        const deltaPaye = Math.round((draft.paye - baseline.paye) * 100) / 100;

        results.push({
          basis,
          baseline,
          draft,
          delta: {
            payeAmount: deltaPaye,
            absoluteAmount: Math.abs(deltaPaye),
            direction:
              deltaPaye > 0.005
                ? 'INCREASE'
                : deltaPaye < -0.005
                  ? 'DECREASE'
                  : 'UNCHANGED',
          },
        });
      } catch {
        skipped++;
      }
    }

    let filtered = results;

    if (dto.minAbsoluteDelta != null && dto.minAbsoluteDelta > 0) {
      filtered = filtered.filter((r) => r.delta.absoluteAmount >= dto.minAbsoluteDelta!);
    }

    if (dto.affectedOnly) {
      filtered = filtered.filter((r) => r.delta.direction !== 'UNCHANGED');
    }

    const summary = this.summaryService.buildSummary(results, skipped, [...warnings]);

    const createdRun = await this.runRepository.createRunWithRows({
      run: {
        authoringVersionId: dto.authoringVersionId,
        countryCode: dto.countryCode,
        basisMode: dto.basisMode,
        payGroupId: dto.payGroupId ?? null,
        payrunId: dto.payrunId ?? null,
        legalEntityId: dto.legalEntityId ?? null,
        limitValue: dto.limit ?? null,
        affectedOnly: dto.affectedOnly ?? false,
        minAbsoluteDelta: dto.minAbsoluteDelta ?? null,

        sourceDraftChecksum: this.computeDraftChecksum(authoring),
        sourceRuntimeTaxTableSetId: runtimeTable?.id ?? null,
        sourceRuntimeChecksum: null,

        employeesAnalyzed: summary.employeesAnalyzed,
        employeesAffected: summary.employeesAffected,
        employeesSkipped: summary.employeesSkipped,

        totalBaselinePaye: summary.totalBaselinePaye,
        totalDraftPaye: summary.totalDraftPaye,
        totalPayeDelta: summary.totalPayeDelta,
        averageDeltaAll: summary.averageDeltaAll,
        averageDeltaAffected: summary.averageDeltaAffected,

        biggestIncreaseJson: summary.biggestIncrease ?? null,
        biggestDecreaseJson: summary.biggestDecrease ?? null,
        bucketSummaryJson: summary.buckets,
        warningsJson: summary.warnings,

        runByUserId: actorUserId,
      },
      rows: filtered.map((r) => ({
        employeeId: r.basis.employeeId,
        employeeNumber: r.basis.employeeNumber ?? null,
        employeeName: r.basis.employeeName ?? null,
        legalEntityName: r.basis.legalEntityName ?? null,
        payGroupName: r.basis.payGroupName ?? null,

        taxableEarnings: r.basis.taxRelevantInputs.taxableEarnings,

        baselinePaye: r.baseline.paye,
        draftPaye: r.draft.paye,
        deltaPaye: r.delta.payeAmount,
        absoluteDelta: r.delta.absoluteAmount,
        direction: r.delta.direction,

        baselineBracketLabel: r.baseline.bracketLabel ?? null,
        draftBracketLabel: r.draft.bracketLabel ?? null,
      })),
    });

    await this.recordAuditEvent(dto, summary);

    return {
      runId: createdRun.id,
      summary,
      rows: filtered.map((r) => this.mapper.toRowDto(r)),
    };
  }

  private computeDraftChecksum(authoring: any): string {
    const canonical = JSON.stringify({
      brackets: authoring.brackets,
      fields: authoring.fields,
    });
    return createHash('sha256').update(canonical).digest('hex').substring(0, 16);
  }

  private async loadAuthoringVersion(id: string) {
    const version = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id },
      include: {
        brackets: { orderBy: { seqNo: 'asc' } },
        fields: true,
      },
    });

    if (!version) {
      throw new TtaException('TTA_NOT_FOUND', 'Authoring version not found', undefined, 404);
    }

    return version;
  }

  private async loadActiveRuntimeTable(
    countryCode: string,
    tableType: string,
  ): Promise<NormalizedRuntimeTaxTable | null> {
    const runtimeSet = await this.prisma.taxTableSet.findFirst({
      where: {
        country: countryCode as any,
        tableType: tableType as any,
        status: 'ACTIVE',
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!runtimeSet) return null;

    return this.mapper.mapRuntimeToNormalized(runtimeSet);
  }

  private async recordAuditEvent(
    dto: RunImpactAnalysisDto,
    summary: any,
  ): Promise<void> {
    try {
      await this.prisma.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId: dto.authoringVersionId,
          eventType: 'impact_analysis_run',
          actorUserId: 'system',
          payloadJson: {
            basisMode: dto.basisMode,
            payGroupId: dto.payGroupId ?? null,
            payrunId: dto.payrunId ?? null,
            countryCode: dto.countryCode,
            limit: dto.limit ?? 500,
            affectedOnly: dto.affectedOnly ?? false,
            minAbsoluteDelta: dto.minAbsoluteDelta ?? 0,
            employeesAnalyzed: summary.employeesAnalyzed,
            employeesAffected: summary.employeesAffected,
            totalPayeDelta: summary.totalPayeDelta,
          },
        },
      });
    } catch {
      // audit failure should not block analysis
    }
  }
}
