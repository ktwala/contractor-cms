import { TaxTableImpactAnalysisMapper } from '../tax-table-impact-analysis.mapper';
import type { NormalizedDraftTaxTable, EmployeeTaxAnalysisBasis } from '../types/tax-table-impact-analysis.types';

describe('TaxTableImpactAnalysisMapper', () => {
  let mapper: TaxTableImpactAnalysisMapper;

  beforeEach(() => {
    mapper = new TaxTableImpactAnalysisMapper();
  });

  describe('mapAuthoringToNormalizedDraft', () => {
    it('should map authoring version to normalized draft shape', () => {
      const authoring = {
        id: 'v1',
        countryCode: 'LS',
        tableType: 'PAYE',
        taxYear: '2025/2026',
        effectiveFrom: new Date('2025-04-01'),
        effectiveTo: null,
        brackets: [
          { seqNo: 1, bracketFrom: '0', bracketTo: '237100', marginalRate: '0.18', baseTax: '0', isOpenEnded: false },
          { seqNo: 2, bracketFrom: '237100', bracketTo: null, marginalRate: '0.30', baseTax: '42678', isOpenEnded: true },
        ],
        fields: [
          { fieldCode: 'annual_tax_credit', fieldValueJson: 11640 },
        ],
      };

      const result = mapper.mapAuthoringToNormalizedDraft(authoring);

      expect(result.id).toBe('v1');
      expect(result.countryCode).toBe('LS');
      expect(result.brackets).toHaveLength(2);
      expect(result.brackets[0].fromAmount).toBe(0);
      expect(result.brackets[0].toAmount).toBe(237100);
      expect(result.brackets[0].rate).toBe(0.18);
      expect(result.brackets[1].isOpenEnded).toBe(true);
      expect(result.supplemental.annual_tax_credit).toBe(11640);
    });
  });

  describe('computePaye', () => {
    const lsBasis: EmployeeTaxAnalysisBasis = {
      employeeId: 'emp-1',
      employeeNumber: 'EMP001',
      employeeName: 'Test Employee',
      legalEntityId: null,
      legalEntityName: null,
      payGroupId: null,
      payGroupName: null,
      countryCode: 'LS',
      age: 35,
      sourcePayrunId: 'pr-1',
      sourcePeriodStart: '2025-04-01',
      sourcePeriodEnd: '2025-04-30',
      sourcePayDate: '2025-04-25',
      taxRelevantInputs: {
        taxableEarnings: 10000,
        preTaxDeductions: 0,
        fringeBenefits: 0,
        retirementDeduction: 0,
        medicalCreditDependants: null,
        additional: {},
      },
    };

    it('should compute LS PAYE with annual credit', () => {
      const taxCtx = mapper.buildTaxTableContext('draft', null, {
        id: 'd1',
        countryCode: 'LS',
        tableType: 'PAYE',
        taxYear: '2025/2026',
        effectiveFrom: '2025-04-01',
        effectiveTo: null,
        brackets: [
          { seqNo: 1, fromAmount: 0, toAmount: 237100, rate: 0.18, baseTax: 0, isOpenEnded: false },
          { seqNo: 2, fromAmount: 237100, toAmount: null, rate: 0.30, baseTax: 42678, isOpenEnded: true },
        ],
        supplemental: { annual_tax_credit: 11640 },
      });

      // monthly 10000 → annual 120000
      // 120000 * 0.18 = 21600 - 11640 credit = 9960 annual
      // 9960 / 12 = 830 monthly
      const result = mapper.computePaye(lsBasis, taxCtx);
      expect(result.paye).toBe(830);
      expect(result.bracketLabel).toContain('Bracket 1');
    });

    it('should compute LS PAYE for zero income', () => {
      const zeroBasis = { ...lsBasis, taxRelevantInputs: { ...lsBasis.taxRelevantInputs, taxableEarnings: 0 } };
      const taxCtx = mapper.buildTaxTableContext('draft', null, {
        id: 'd1', countryCode: 'LS', tableType: 'PAYE', taxYear: '2025', effectiveFrom: '2025-01-01', effectiveTo: null,
        brackets: [{ seqNo: 1, fromAmount: 0, toAmount: null, rate: 0.18, baseTax: 0, isOpenEnded: true }],
        supplemental: { annual_tax_credit: 11640 },
      });
      const result = mapper.computePaye(zeroBasis, taxCtx);
      expect(result.paye).toBe(0);
    });

    it('should compute ZA PAYE with age-based rebates', () => {
      const zaBasis: EmployeeTaxAnalysisBasis = {
        ...lsBasis,
        countryCode: 'ZA',
        age: 67,
        taxRelevantInputs: { ...lsBasis.taxRelevantInputs, taxableEarnings: 20000 },
      };

      const taxCtx = mapper.buildTaxTableContext('draft', null, {
        id: 'd2', countryCode: 'ZA', tableType: 'PAYE', taxYear: '2025', effectiveFrom: '2025-03-01', effectiveTo: null,
        brackets: [
          { seqNo: 1, fromAmount: 0, toAmount: 237100, rate: 0.18, baseTax: 0, isOpenEnded: false },
          { seqNo: 2, fromAmount: 237100, toAmount: null, rate: 0.26, baseTax: 42678, isOpenEnded: true },
        ],
        supplemental: { primary_rebate: 17235, secondary_rebate: 9444, tertiary_rebate: 3145 },
      });

      // monthly 20000 → annual 240000
      // bracket 2: 42678 + 0.26 * (240000 - 237100) = 42678 + 754 = 43432
      // rebate: 17235 + 9444 (age 67) = 26679
      // 43432 - 26679 = 16753 annual → 1396.08 monthly
      const result = mapper.computePaye(zaBasis, taxCtx);
      expect(result.paye).toBeCloseTo(1396.08, 0);
    });

    it('should not produce negative PAYE', () => {
      const lowBasis: EmployeeTaxAnalysisBasis = {
        ...lsBasis,
        countryCode: 'ZA',
        age: 30,
        taxRelevantInputs: { ...lsBasis.taxRelevantInputs, taxableEarnings: 4000 },
      };

      const taxCtx = mapper.buildTaxTableContext('draft', null, {
        id: 'd3', countryCode: 'ZA', tableType: 'PAYE', taxYear: '2025', effectiveFrom: '2025-03-01', effectiveTo: null,
        brackets: [{ seqNo: 1, fromAmount: 0, toAmount: null, rate: 0.18, baseTax: 0, isOpenEnded: true }],
        supplemental: { primary_rebate: 17235 },
      });

      const result = mapper.computePaye(lowBasis, taxCtx);
      expect(result.paye).toBe(0);
    });
  });

  describe('toRowDto', () => {
    it('should map per-employee result to row DTO', () => {
      const result: any = {
        basis: {
          employeeId: 'emp-1',
          employeeNumber: 'E001',
          employeeName: 'John Doe',
          legalEntityName: 'Corp',
          payGroupName: 'Monthly',
          taxRelevantInputs: { taxableEarnings: 15000 },
        },
        baseline: { paye: 1200, bracketLabel: 'B1' },
        draft: { paye: 1350, bracketLabel: 'B1' },
        delta: { payeAmount: 150, absoluteAmount: 150, direction: 'INCREASE' },
      };

      const row = mapper.toRowDto(result);
      expect(row.employeeId).toBe('emp-1');
      expect(row.baselinePaye).toBe(1200);
      expect(row.draftPaye).toBe(1350);
      expect(row.deltaPaye).toBe(150);
      expect(row.direction).toBe('INCREASE');
    });
  });
});
