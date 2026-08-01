import { TaxTableAuthoringSimulationService } from '../tax-table-authoring.simulation.service';
import { AuthoringDraft } from '../types/authoring.types';

const lsDraft: AuthoringDraft = {
  id: 'ls-draft-1',
  countryCode: 'LS',
  tableType: 'PAYE',
  taxYear: '2025/2026',
  effectiveFrom: new Date('2025-04-01'),
  effectiveTo: null,
  status: 'DRAFT',
  sourceType: 'TEMPLATE',
  sourceReference: 'LRA',
  sourceChecksum: null,
  copiedFromAuthoringId: null,
  publishedTaxTableSetId: null,
  createdByUserId: 'user-1',
  reviewedByUserId: null,
  publishedByUserId: null,
  publishReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: null,
  templateId: null,
  templateCode: null,
  templateVersion: null,
  brackets: [
    { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
    { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
  ],
  fields: [{ id: 'f1', fieldCode: 'annual_tax_credit', fieldValue: 11640 }],
};

const zaDraft: AuthoringDraft = {
  id: 'za-draft-1',
  countryCode: 'ZA',
  tableType: 'PAYE',
  taxYear: '2025/2026',
  effectiveFrom: new Date('2025-03-01'),
  effectiveTo: null,
  status: 'DRAFT',
  sourceType: 'TEMPLATE',
  sourceReference: 'SARS',
  sourceChecksum: null,
  copiedFromAuthoringId: null,
  publishedTaxTableSetId: null,
  createdByUserId: 'user-1',
  reviewedByUserId: null,
  publishedByUserId: null,
  publishReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: null,
  templateId: null,
  templateCode: null,
  templateVersion: null,
  brackets: [
    { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
    { id: 'b2', seqNo: 2, bracketFrom: 237101, bracketTo: 370500, marginalRate: 0.26, baseTax: 42678, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
    { id: 'b3', seqNo: 3, bracketFrom: 370501, bracketTo: null, marginalRate: 0.31, baseTax: 77362, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
  ],
  fields: [
    { id: 'f1', fieldCode: 'primary_rebate', fieldValue: 17235 },
    { id: 'f2', fieldCode: 'secondary_rebate', fieldValue: 9444 },
    { id: 'f3', fieldCode: 'tertiary_rebate', fieldValue: 3145 },
  ],
};

describe('TaxTableAuthoringSimulationService', () => {
  let service: TaxTableAuthoringSimulationService;

  beforeEach(() => {
    const mockAuthoringService = {
      getById: jest.fn().mockImplementation((id: string) => {
        if (id === 'ls-draft-1') return Promise.resolve(lsDraft);
        if (id === 'za-draft-1') return Promise.resolve(zaDraft);
        throw new Error('Not found');
      }),
    };
    service = new TaxTableAuthoringSimulationService(mockAuthoringService as any);
  });

  describe('LS simulation', () => {
    it('should compute zero tax for zero income', async () => {
      const result = await service.simulate('ls-draft-1', { annualIncomes: [0] });
      expect(result.results[0].annualTax).toBe(0);
      expect(result.results[0].monthlyTax).toBe(0);
    });

    it('should apply LS brackets and credit correctly', async () => {
      const result = await service.simulate('ls-draft-1', { annualIncomes: [100000] });
      // 100000 * 0.18 = 18000 - 11640 credit = 6360
      expect(result.results[0].annualTax).toBe(6360);
      expect(result.results[0].monthlyTax).toBe(530);
    });

    it('should apply second bracket for high income', async () => {
      const result = await service.simulate('ls-draft-1', { annualIncomes: [500000] });
      // baseTax 42678 + (500000 - 237100) * 0.30 = 42678 + 78870 = 121548 - 11640 = 109908
      expect(result.results[0].annualTax).toBe(109908);
      expect(result.results[0].bracketUsed).toBe(2);
    });

    it('should handle multiple incomes in one call', async () => {
      const result = await service.simulate('ls-draft-1', {
        annualIncomes: [0, 100000, 237100, 500000],
      });
      expect(result.results).toHaveLength(4);
    });
  });

  describe('ZA simulation', () => {
    it('should apply primary rebate for under-65', async () => {
      const result = await service.simulate('za-draft-1', {
        annualIncomes: [200000],
        age: 30,
      });
      // 200000 * 0.18 = 36000 - 17235 rebate = 18765
      expect(result.results[0].annualTax).toBe(18765);
    });

    it('should apply primary + secondary rebate for 65+', async () => {
      const result = await service.simulate('za-draft-1', {
        annualIncomes: [200000],
        age: 67,
      });
      // 36000 - 17235 - 9444 = 9321
      expect(result.results[0].annualTax).toBe(9321);
    });

    it('should apply all three rebates for 75+', async () => {
      const result = await service.simulate('za-draft-1', {
        annualIncomes: [200000],
        age: 78,
      });
      // 36000 - 17235 - 9444 - 3145 = 6176
      expect(result.results[0].annualTax).toBe(6176);
    });

    it('should not produce negative tax', async () => {
      const result = await service.simulate('za-draft-1', {
        annualIncomes: [50000],
        age: 30,
      });
      expect(result.results[0].annualTax).toBe(0);
    });
  });
});
