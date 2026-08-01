import { Injectable } from '@nestjs/common';
import type { ImpactAnalysisSummaryDto } from './dto/impact-analysis-response.dto';
import type { ImpactAnalysisPerEmployeeResult } from './types/tax-table-impact-analysis.types';

const BUCKET_DEFS = [
  { label: 'Decrease > 500', test: (v: number) => v < -500 },
  { label: 'Decrease 100–500', test: (v: number) => v >= -500 && v <= -100 },
  { label: 'Decrease 1–99', test: (v: number) => v >= -99 && v < 0 },
  { label: 'Unchanged', test: (v: number) => v === 0 },
  { label: 'Increase 1–99', test: (v: number) => v > 0 && v <= 99 },
  { label: 'Increase 100–500', test: (v: number) => v >= 100 && v <= 500 },
  { label: 'Increase > 500', test: (v: number) => v > 500 },
];

@Injectable()
export class TaxTableImpactAnalysisSummaryService {
  buildSummary(
    rows: ImpactAnalysisPerEmployeeResult[],
    employeesSkipped: number,
    warnings: string[],
  ): ImpactAnalysisSummaryDto {
    const employeesAnalyzed = rows.length;
    const affected = rows.filter((r) => r.delta.direction !== 'UNCHANGED');
    const increases = rows.filter((r) => r.delta.direction === 'INCREASE');
    const decreases = rows.filter((r) => r.delta.direction === 'DECREASE');

    const totalBaselinePaye = this.round2(rows.reduce((s, r) => s + r.baseline.paye, 0));
    const totalDraftPaye = this.round2(rows.reduce((s, r) => s + r.draft.paye, 0));
    const totalPayeDelta = this.round2(totalDraftPaye - totalBaselinePaye);

    const biggestIncrease = increases.length
      ? increases.reduce((best, r) => (r.delta.payeAmount > best.delta.payeAmount ? r : best))
      : null;

    const biggestDecrease = decreases.length
      ? decreases.reduce((best, r) => (r.delta.payeAmount < best.delta.payeAmount ? r : best))
      : null;

    return {
      employeesAnalyzed,
      employeesAffected: affected.length,
      employeesUnchanged: employeesAnalyzed - affected.length,
      employeesSkipped,

      totalBaselinePaye,
      totalDraftPaye,
      totalPayeDelta,

      averageDeltaAll: employeesAnalyzed
        ? this.round2(totalPayeDelta / employeesAnalyzed)
        : 0,
      averageDeltaAffected: affected.length
        ? this.round2(
            affected.reduce((s, r) => s + r.delta.payeAmount, 0) / affected.length,
          )
        : 0,

      biggestIncrease: biggestIncrease
        ? {
            employeeId: biggestIncrease.basis.employeeId,
            amount: biggestIncrease.delta.payeAmount,
          }
        : null,

      biggestDecrease: biggestDecrease
        ? {
            employeeId: biggestDecrease.basis.employeeId,
            amount: biggestDecrease.delta.payeAmount,
          }
        : null,

      buckets: BUCKET_DEFS.map((def) => ({
        label: def.label,
        count: rows.filter((r) => def.test(r.delta.payeAmount)).length,
      })),

      warnings,
    };
  }

  private round2(x: number): number {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }
}
