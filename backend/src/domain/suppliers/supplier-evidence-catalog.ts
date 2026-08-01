import { SupplierType } from '@prisma/client';
import { SupplierJurisdictionCode } from './supplier-jurisdiction.constants';

/** Canonical evidence type codes (jurisdiction packs reference these). */
export const SUPPLIER_EVIDENCE_DOC_TYPES = {
  COMPANY_REGISTRATION: 'COMPANY_REGISTRATION',
  TAX_CLEARANCE: 'TAX_CLEARANCE',
  BANK_CONFIRMATION: 'BANK_CONFIRMATION',
  BBBEE_CERTIFICATE: 'BBBEE_CERTIFICATE',
  TRADING_LICENCE: 'TRADING_LICENCE',
  REPRESENTATIVE_ID: 'REPRESENTATIVE_ID',
  MASTER_SUPPLIER_AGREEMENT: 'MASTER_SUPPLIER_AGREEMENT',
} as const;

export type SupplierEvidenceDocType =
  (typeof SUPPLIER_EVIDENCE_DOC_TYPES)[keyof typeof SUPPLIER_EVIDENCE_DOC_TYPES];

export type EvidenceChecklistItemStatus = 'MISSING' | 'PRESENT' | 'EXPIRED';

export interface RequiredEvidenceDefinition {
  type: string;
  label: string;
  description: string;
  appliesTo: 'COMPANY' | 'INDIVIDUAL' | 'ALL';
  requiresExpiry: boolean;
}

/** South Africa onboarding evidence pack. */
export const ZA_SUPPLIER_EVIDENCE_PACK: RequiredEvidenceDefinition[] = [
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
    label: 'Company registration',
    description: 'CIPC registration certificate or equivalent',
    appliesTo: 'COMPANY',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    label: 'SARS tax clearance / PIN',
    description: 'Valid SARS tax clearance or tax pin certificate',
    appliesTo: 'ALL',
    requiresExpiry: true,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
    label: 'Bank confirmation letter',
    description: 'Bank-stamped confirmation letter (document file only)',
    appliesTo: 'ALL',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
    label: 'B-BBEE certificate or affidavit',
    description: 'B-BBEE certificate or sworn affidavit',
    appliesTo: 'COMPANY',
    requiresExpiry: true,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
    label: 'Director / representative ID',
    description: 'Identity document for authorised representative',
    appliesTo: 'ALL',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    label: 'Signed supplier agreement',
    description: 'Executed master supplier agreement',
    appliesTo: 'ALL',
    requiresExpiry: true,
  },
];

/** Lesotho onboarding evidence pack (no B-BBEE). */
export const LS_SUPPLIER_EVIDENCE_PACK: RequiredEvidenceDefinition[] = [
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
    label: 'Company registration / incorporation',
    description: 'Company registration or incorporation document',
    appliesTo: 'COMPANY',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    label: 'LRA tax clearance / registration',
    description: 'LRA tax clearance or tax registration evidence',
    appliesTo: 'ALL',
    requiresExpiry: true,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
    label: 'Bank confirmation letter',
    description: 'Bank-stamped confirmation letter (document file only)',
    appliesTo: 'ALL',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE,
    label: 'Trading licence / business permit',
    description: 'Trading licence or relevant business permit, if applicable',
    appliesTo: 'COMPANY',
    requiresExpiry: true,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
    label: 'Director / representative ID or passport',
    description: 'Identity document or passport for authorised representative',
    appliesTo: 'ALL',
    requiresExpiry: false,
  },
  {
    type: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    label: 'Signed supplier agreement',
    description: 'Executed supplier agreement',
    appliesTo: 'ALL',
    requiresExpiry: true,
  },
];

export const SUPPLIER_EVIDENCE_PACKS: Record<
  SupplierJurisdictionCode,
  RequiredEvidenceDefinition[]
> = {
  ZA: ZA_SUPPLIER_EVIDENCE_PACK,
  LS: LS_SUPPLIER_EVIDENCE_PACK,
};

export function getEvidencePackForJurisdiction(
  jurisdiction: SupplierJurisdictionCode,
): RequiredEvidenceDefinition[] {
  return SUPPLIER_EVIDENCE_PACKS[jurisdiction];
}

export function getRequiredEvidenceDefinitions(
  jurisdiction: SupplierJurisdictionCode,
  supplierType: SupplierType,
): RequiredEvidenceDefinition[] {
  return getEvidencePackForJurisdiction(jurisdiction).filter((def) => {
    if (def.appliesTo === 'ALL') return true;
    if (supplierType === SupplierType.COMPANY) return def.appliesTo === 'COMPANY';
    return def.appliesTo === 'INDIVIDUAL';
  });
}

export function isKnownEvidenceDocType(
  type: string,
  jurisdiction: SupplierJurisdictionCode,
): boolean {
  return getEvidencePackForJurisdiction(jurisdiction).some((d) => d.type === type);
}

export function listEvidenceTypeOptionsForJurisdiction(
  jurisdiction: SupplierJurisdictionCode,
): Array<{ value: string; label: string }> {
  return getEvidencePackForJurisdiction(jurisdiction).map((d) => ({
    value: d.type,
    label: d.label,
  }));
}
