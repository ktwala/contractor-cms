import { TaxTableImpactAnalysisSummaryService } from '../tax-table-impact-analysis-summary.service';
import type { ImpactAnalysisPerEmployeeResult } from '../types/tax-table-impact-analysis.types';

function makeResult(paye: { baseline: number; draft: number }): ImpactAnalysisPerEmployeeResult {
  const delta = Math.round((paye.draft - paye.baseline) * 100) / 100;
  return {
    basis: {
      employeeId: `emp-${Math.random().toString(36).slice(2, 6)}`,
      employeeNumber: null,
      employeeName: null,
      legalEntityId: null,
      legalEntityName: null,
      payGroupId: null,
      payGroupName: null,
      countryCode: 'LS',
      age: 30,
      sourcePayrunId: 'pr-1',
      sourcePeriodStart: '',
      sourcePeriodEnd: '',
      sourcePayDate: '',
      taxRelevantInputs: {
        taxableEarnings: 10000,
        preTaxDeductions: 0,
        fringeBenefits: 0,
        retirementDeduction: 0,
        medicalCreditDependants: null,
        additional: {},
      },
    },
    baseline: { paye: paye.baseline, bracketLabel: null, warnings: [] },
    draft: { paye: paye.draft, bracketLabel: null, warnings: [] },
    delta: {
      payeAmount: delta,
      absoluteAmount: Math.abs(delta),
      direction: delta > 0 ? 'INCREASE' : delta < 0 ? 'DECREASE' : 'UNCHANGED',
    },
  };
}

describe('TaxTableImpactAnalysisSummaryService', () => {
  let service: TaxTableImpactAnalysisSummaryService;

  beforeEach(() => {
    service = new TaxTableImpactAnalysisSummaryService();
  });

  it('should aggregate summary correctly', () => {
    const rows = [
      makeResult({ baseline: 1000, draft: 1200 }),
      makeResult({ baseline: 800, draft: 800 }),
      makeResult({ baseline: 1500, draft: 1400 }),
      makeResult({ baseline: 2000, draft: 2600 }),
    ];

    const summary = service.buildSummary(rows, 1, ['test warning']);

    expect(summary.employeesAnalyzed).toBe(4);
    expect(summary.employeesAffected).toBe(3);
    expect(summary.employeesUnchanged).toBe(1);
    expect(summary.employeesSkipped).toBe(1);
    expect(summary.totalBaselinePaye).toBe(5300);
    expect(summary.totalDraftPaye).toBe(6000);
    expect(summary.totalPayeDelta).toBe(700);
    expect(summary.biggestIncrease!.amount).toBe(600);
    expect(summary.biggestDecrease!.amount).toBe(-100);
    expect(summary.warnings).toContain('test warning');
  });

  it('should handle all unchanged rows', () => {
    const rows = [
      makeResult({ baseline: 500, draft: 500 }),
      makeResult({ baseline: 700, draft: 700 }),
    ];

    const summary = service.buildSummary(rows, 0, []);

    expect(summary.employeesAffected).toBe(0);
    expect(summary.employeesUnchanged).toBe(2);
    expect(summary.totalPayeDelta).toBe(0);
    expect(summary.biggestIncrease).toBeNull();
    expect(summary.biggestDecrease).toBeNull();
  });

  it('should produce correct buckets', () => {
    const rows = [
      makeResult({ baseline: 1000, draft: 1600 }),   // +600 → >500
      makeResult({ baseline: 1000, draft: 1200 }),   // +200 → 100-500
      makeResult({ baseline: 1000, draft: 1050 }),   // +50  → 1-99
      makeResult({ baseline: 1000, draft: 1000 }),   // 0    → unchanged
      makeResult({ baseline: 1000, draft: 950 }),    // -50  → 1-99
      makeResult({ baseline: 1000, draft: 700 }),    // -300 → 100-500
      makeResult({ baseline: 1000, draft: 400 }),    // -600 → >500
    ];

    const summary = service.buildSummary(rows, 0, []);
    const bucketMap = new Map(summary.buckets.map((b) => [b.label, b.count]));

    expect(bucketMap.get('Increase > 500')).toBe(1);
    expect(bucketMap.get('Increase 100–500')).toBe(1);
    expect(bucketMap.get('Increase 1–99')).toBe(1);
    expect(bucketMap.get('Unchanged')).toBe(1);
    expect(bucketMap.get('Decrease 1–99')).toBe(1);
    expect(bucketMap.get('Decrease 100–500')).toBe(1);
    expect(bucketMap.get('Decrease > 500')).toBe(1);
  });

  it('should handle empty rows', () => {
    const summary = service.buildSummary([], 5, []);
    expect(summary.employeesAnalyzed).toBe(0);
    expect(summary.employeesSkipped).toBe(5);
    expect(summary.averageDeltaAll).toBe(0);
    expect(summary.averageDeltaAffected).toBe(0);
  });
});
