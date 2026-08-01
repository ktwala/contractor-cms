export const SUPPLIER_EVIDENCE_DOC_TYPES = {
  COMPANY_REGISTRATION: 'COMPANY_REGISTRATION',
  TAX_CLEARANCE: 'TAX_CLEARANCE',
  BANK_CONFIRMATION: 'BANK_CONFIRMATION',
  BBBEE_CERTIFICATE: 'BBBEE_CERTIFICATE',
  TRADING_LICENCE: 'TRADING_LICENCE',
  REPRESENTATIVE_ID: 'REPRESENTATIVE_ID',
  MASTER_SUPPLIER_AGREEMENT: 'MASTER_SUPPLIER_AGREEMENT',
} as const;

export type SupplierJurisdictionCode = 'ZA' | 'LS';

export const SUPPORTED_SUPPLIER_JURISDICTIONS: SupplierJurisdictionCode[] = ['ZA', 'LS'];

export type EvidenceChecklistItemStatus = 'MISSING' | 'PRESENT' | 'EXPIRED';

export interface EvidenceChecklistItem {
  type: string;
  label: string;
  description: string;
  requiresExpiry: boolean;
  status: EvidenceChecklistItemStatus;
  documentId: string | null;
  fileName: string | null;
  expiryDate: string | null;
  uploadedAt: string | null;
}

export interface EvidenceChecklistResult {
  supplierId: string;
  supplierType: string;
  jurisdictionCode: SupplierJurisdictionCode;
  complete: boolean;
  items: EvidenceChecklistItem[];
  missingCount: number;
  expiredCount: number;
}

export interface SupplierDocumentView {
  id: string;
  supplierId: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate: string | null;
  notes: string | null;
  uploadedAt: string;
  updatedAt: string;
  expired: boolean;
}

const ZA_EVIDENCE_OPTIONS = [
  { value: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION, label: 'Company registration' },
  { value: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE, label: 'SARS tax clearance / PIN' },
  { value: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION, label: 'Bank confirmation letter' },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
    label: 'B-BBEE certificate or affidavit',
  },
  { value: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID, label: 'Director / representative ID' },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    label: 'Signed supplier agreement',
  },
];

const LS_EVIDENCE_OPTIONS = [
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
    label: 'Company registration / incorporation',
  },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    label: 'LRA tax clearance / registration',
  },
  { value: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION, label: 'Bank confirmation letter' },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE,
    label: 'Trading licence / business permit',
  },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
    label: 'Director / representative ID or passport',
  },
  {
    value: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
    label: 'Signed supplier agreement',
  },
];

export function resolveSupplierJurisdictionCode(
  country?: string | null,
  countryCode?: string | null,
): SupplierJurisdictionCode {
  const code = (countryCode || country || 'ZA').trim().toUpperCase();
  if (code === 'LS') return 'LS';
  return 'ZA';
}

export function evidenceTypeOptionsForJurisdiction(
  jurisdiction: SupplierJurisdictionCode,
): Array<{ value: string; label: string }> {
  return jurisdiction === 'LS' ? LS_EVIDENCE_OPTIONS : ZA_EVIDENCE_OPTIONS;
}

export function evidenceStatusClass(status: EvidenceChecklistItemStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-green-100 text-green-800';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export function jurisdictionLabel(code: SupplierJurisdictionCode): string {
  return code === 'LS' ? 'Lesotho' : 'South Africa';
}
