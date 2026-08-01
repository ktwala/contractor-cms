import { SupplierType } from '@prisma/client';
import {
  SUPPLIER_EVIDENCE_DOC_TYPES,
  getRequiredEvidenceDefinitions,
} from '../supplier-evidence-catalog';

describe('supplier-evidence-catalog (jurisdiction packs)', () => {
  it('ZA company pack includes B-BBEE', () => {
    const defs = getRequiredEvidenceDefinitions('ZA', SupplierType.COMPANY);
    expect(defs.some((d) => d.type === SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE)).toBe(
      true,
    );
  });

  it('LS company pack excludes B-BBEE and includes trading licence', () => {
    const defs = getRequiredEvidenceDefinitions('LS', SupplierType.COMPANY);
    expect(defs.some((d) => d.type === SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE)).toBe(
      false,
    );
    expect(defs.some((d) => d.type === SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE)).toBe(
      true,
    );
  });

  it('LS individual pack excludes company-only items', () => {
    const defs = getRequiredEvidenceDefinitions('LS', SupplierType.INDIVIDUAL);
    expect(defs.some((d) => d.type === SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE)).toBe(
      false,
    );
    expect(defs.some((d) => d.type === SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE)).toBe(
      true,
    );
  });
});
