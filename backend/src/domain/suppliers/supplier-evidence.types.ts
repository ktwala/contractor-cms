import { SupplierType } from '@prisma/client';
import { EvidenceChecklistItemStatus } from './supplier-evidence-catalog';
import { SupplierJurisdictionCode } from './supplier-jurisdiction.constants';

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
  supplierType: SupplierType;
  jurisdictionCode: SupplierJurisdictionCode;
  complete: boolean;
  items: EvidenceChecklistItem[];
  missingCount: number;
  expiredCount: number;
}
