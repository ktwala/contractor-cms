import { TaxTableAuthoringValidationService } from '../tax-table-authoring.validation.service';
import { AuthoringDraft, AuthoringBracketRow } from '../types/authoring.types';

function makeDraft(overrides: Partial<AuthoringDraft> = {}): AuthoringDraft {
  return {
    id: 'test-id',
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

describe('TaxTableAuthoringValidationService', () => {
  let service: TaxTableAuthoringValidationService;

  beforeEach(() => {
    service = new TaxTableAuthoringValidationService(null as any);
  });

  it('should pass valid LS draft with no errors', () => {
    const issues = service.validateDraft(makeDraft());
    const errors = issues.filter((i) => i.severity === 'ERROR');
    expect(errors).toHaveLength(0);
  });

  it('should detect no brackets', () => {
    const issues = service.validateDraft(makeDraft({ brackets: [] }));
    expect(issues.find((i) => i.code === 'NO_BRACKETS')).toBeDefined();
  });

  it('should detect first bracket not starting at 0', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 100, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'BRACKET_GAP_AT_ZERO')).toBeDefined();
  });

  it('should detect gap between brackets', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 100000, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 200000, bracketTo: null, marginalRate: 0.30, baseTax: 18000, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'BRACKET_GAP')).toBeDefined();
  });

  it('should detect bracket overlap', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 300000, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 200000, bracketTo: null, marginalRate: 0.30, baseTax: 36000, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'BRACKET_OVERLAP')).toBeDefined();
  });

  it('should detect multiple open-ended brackets', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: null, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'MULTIPLE_OPEN_ENDED')).toBeDefined();
  });

  it('should detect open-ended bracket not last', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: null, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: 500000, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'OPEN_ENDED_NOT_LAST')).toBeDefined();
  });

  it('should detect invalid marginal rate', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 1.5, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'INVALID_RATE')).toBeDefined();
  });

  it('should detect negative base tax', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: -100, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'NEGATIVE_BASE_TAX')).toBeDefined();
  });

  it('should detect base tax mismatch (derived vs stated)', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 99999, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: null },
      ],
    }));
    expect(issues.find((i) => i.code === 'BASE_TAX_MISMATCH')).toBeDefined();
  });

  it('should downgrade base tax mismatch to warning when override reason provided', () => {
    const issues = service.validateDraft(makeDraft({
      brackets: [
        { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, derivedBaseTax: null, isOpenEnded: false, baseTaxOverrideReason: null },
        { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 99999, derivedBaseTax: null, isOpenEnded: true, baseTaxOverrideReason: 'Rounding per LRA guidance' },
      ],
    }));
    const mismatch = issues.find((i) => i.code === 'BASE_TAX_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('WARNING');
  });

  it('should warn on missing required LS field', () => {
    const issues = service.validateDraft(makeDraft({ fields: [] }));
    expect(issues.find((i) => i.code === 'MISSING_REQUIRED_FIELD')).toBeDefined();
  });

  it('should warn on missing required ZA fields', () => {
    const issues = service.validateDraft(makeDraft({
      countryCode: 'ZA',
      fields: [],
    }));
    const missing = issues.filter((i) => i.code === 'MISSING_REQUIRED_FIELD');
    expect(missing.length).toBeGreaterThanOrEqual(3);
  });
});
