import { TaxTableAuthoringDiffService } from '../tax-table-authoring.diff.service';
import { AuthoringDraft } from '../types/authoring.types';

function makeDraft(overrides: Partial<AuthoringDraft> = {}): AuthoringDraft {
  return {
    id: 'draft-1',
    countryCode: 'LS',
    tableType: 'PAYE',
    taxYear: '2025/2026',
    effectiveFrom: new Date('2025-04-01'),
    effectiveTo: null,
    status: 'DRAFT',
    sourceType: 'MANUAL',
    sourceReference: null,
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
    ...overrides,
  };
}

describe('TaxTableAuthoringDiffService', () => {
  let service: TaxTableAuthoringDiffService;

  beforeEach(() => {
    const mockAuthoring = {
      getById: jest.fn().mockImplementation((id: string) => {
        if (id === 'v1') return Promise.resolve(makeDraft({ id: 'v1', taxYear: '2024/2025' }));
        if (id === 'v2') return Promise.resolve(makeDraft({
          id: 'v2',
          taxYear: '2025/2026',
          brackets: [
            { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 250000, marginalRate: 0.20, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
            { id: 'b2', seqNo: 2, bracketFrom: 250000, bracketTo: null, marginalRate: 0.32, baseTax: 50000, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
          ],
          fields: [{ id: 'f1', fieldCode: 'annual_tax_credit', fieldValue: 12000 }],
        }));
        throw new Error('Not found');
      }),
    };

    service = new TaxTableAuthoringDiffService(null as any, mockAuthoring as any);
  });

  it('should detect taxYear change between versions', async () => {
    const diff = await service.diffBetweenVersions('v1', 'v2');
    expect(diff.metadataChanges.find((c) => c.field === 'taxYear')).toBeDefined();
  });

  it('should detect bracket rate changes', async () => {
    const diff = await service.diffBetweenVersions('v1', 'v2');
    expect(diff.bracketChanges.length).toBeGreaterThan(0);
    const rateChange = diff.bracketChanges.find((c) => c.field === 'rate');
    expect(rateChange).toBeDefined();
  });

  it('should detect field value changes', async () => {
    const diff = await service.diffBetweenVersions('v1', 'v2');
    const creditChange = diff.fieldChanges.find((c) => c.fieldCode === 'annual_tax_credit');
    expect(creditChange).toBeDefined();
    expect(creditChange!.previous).toBe(11640);
    expect(creditChange!.current).toBe(12000);
  });

  it('should report zero changes for identical versions', async () => {
    const diff = await service.diffBetweenVersions('v1', 'v1');
    expect(diff.bracketChanges).toHaveLength(0);
    expect(diff.fieldChanges).toHaveLength(0);
    expect(diff.metadataChanges).toHaveLength(0);
  });
});
