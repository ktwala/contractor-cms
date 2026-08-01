import { SupplierStatus, SupplierType } from '@prisma/client';
import { SupplierRuleEvaluator } from './supplier.rule';
import { PdpReasonCode } from '../pdp.reason-codes';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../../domain/suppliers/supplier-evidence-catalog';

describe('SupplierRuleEvaluator (PR-CMS-OPERATIONS-1D2)', () => {
  const supplierId = 'sup-1';
  const action = 'SUBMIT_TIMESHEET' as const;
  const context = { supplierId, transactionDate: new Date() };

  function buildPrisma(supplier: Record<string, unknown> | null) {
    return {
      supplier: {
        findUnique: jest.fn().mockResolvedValue(supplier),
      },
    } as never;
  }

  it('returns SUPPLIER_NOT_APPROVED when supplier is missing', async () => {
    const evaluator = new SupplierRuleEvaluator(buildPrisma(null));
    const result = await evaluator.evaluate(action, context);
    expect(result.reason_code).toBe(PdpReasonCode.SUPPLIER_NOT_APPROVED);
    expect(result.decision).toBe('HOLD');
  });

  it('returns SUPPLIER_NOT_APPROVED when supplier is not ACTIVE', async () => {
    const evaluator = new SupplierRuleEvaluator(
      buildPrisma({
        id: supplierId,
        status: SupplierStatus.PENDING_APPROVAL,
        type: SupplierType.COMPANY,
        country: 'ZA',
        countryCode: 'ZA',
        documents: [],
        organization: { supplierAuthorityMode: 'CMS_ONLY' },
      }),
    );
    const result = await evaluator.evaluate(action, context);
    expect(result.reason_code).toBe(PdpReasonCode.SUPPLIER_NOT_APPROVED);
  });

  it('returns MISSING_REQUIRED_DOCS when ACTIVE but evidence incomplete', async () => {
    const evaluator = new SupplierRuleEvaluator(
      buildPrisma({
        id: supplierId,
        status: SupplierStatus.ACTIVE,
        type: SupplierType.COMPANY,
        country: 'ZA',
        countryCode: 'ZA',
        documents: [],
        organization: { supplierAuthorityMode: 'CMS_ONLY' },
      }),
    );
    const result = await evaluator.evaluate(action, context);
    expect(result.reason_code).toBe(PdpReasonCode.MISSING_REQUIRED_DOCS);
    expect(result.decision).toBe('HOLD');
  });

  it('returns ALLOW when ACTIVE with complete evidence', async () => {
    const future = new Date('2030-12-31');
    const types = [
      SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
      SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
      SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
      SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
      SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    ];
    const documents = types.map((type, i) => ({
      id: `doc-${i}`,
      type,
      fileName: `${type}.pdf`,
      expiryDate:
        type === SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION ||
        type === SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID
          ? null
          : future,
      uploadedAt: new Date(),
    }));

    const evaluator = new SupplierRuleEvaluator(
      buildPrisma({
        id: supplierId,
        status: SupplierStatus.ACTIVE,
        type: SupplierType.COMPANY,
        country: 'ZA',
        countryCode: 'ZA',
        documents,
        organization: { supplierAuthorityMode: 'CMS_ONLY' },
      }),
    );
    const result = await evaluator.evaluate(action, context);
    expect(result.decision).toBe('ALLOW');
  });
});
