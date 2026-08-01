import { SupplierType } from '@prisma/client';
import { SupplierEvidenceChecklistService } from '../supplier-evidence-checklist.service';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../supplier-evidence-catalog';

describe('SupplierEvidenceChecklistService', () => {
  const service = new SupplierEvidenceChecklistService(null as never);

  const future = new Date('2030-06-01T00:00:00.000Z');
  const past = new Date('2020-01-01T00:00:00.000Z');
  const now = new Date('2025-06-01T00:00:00.000Z');

  it('marks checklist incomplete when required types are missing (ZA)', () => {
    const result = service.evaluateChecklist(
      'sup-1',
      SupplierType.COMPANY,
      'ZA',
      [],
      now,
    );

    expect(result.jurisdictionCode).toBe('ZA');
    expect(result.complete).toBe(false);
    expect(result.missingCount).toBeGreaterThan(0);
  });

  it('marks ZA company checklist complete with ZA pack docs', () => {
    const docs = [
      SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
      SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
      SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
      SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    ].map((type, idx) => ({
      id: `doc-${idx}`,
      type,
      fileName: `${type}.pdf`,
      expiryDate:
        type === SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION
          ? null
          : future,
      uploadedAt: new Date('2025-01-01'),
    }));

    const result = service.evaluateChecklist(
      'sup-1',
      SupplierType.COMPANY,
      'ZA',
      docs,
      now,
    );

    expect(result.complete).toBe(true);
  });

  it('LS company complete without B-BBEE', () => {
    const docs = [
      SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
      SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE,
      SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
      SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    ].map((type, idx) => ({
      id: `ls-${idx}`,
      type,
      fileName: `${type}.pdf`,
      expiryDate:
        type === SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION
          ? null
          : future,
      uploadedAt: new Date('2025-01-01'),
    }));

    const result = service.evaluateChecklist(
      'sup-ls',
      SupplierType.COMPANY,
      'LS',
      docs,
      now,
    );

    expect(result.jurisdictionCode).toBe('LS');
    expect(result.complete).toBe(true);
    expect(
      result.items.some((i) => i.type === SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE),
    ).toBe(false);
  });

  it('treats expired required docs as incomplete', () => {
    const docs = [
      {
        id: 'tax-1',
        type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
        fileName: 'tax.pdf',
        expiryDate: past,
        uploadedAt: new Date('2024-01-01'),
      },
    ];

    const result = service.evaluateChecklist(
      'sup-1',
      SupplierType.INDIVIDUAL,
      'ZA',
      docs,
      now,
    );

    const taxItem = result.items.find(
      (i) => i.type === SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    );
    expect(taxItem?.status).toBe('EXPIRED');
    expect(result.complete).toBe(false);
  });
});
