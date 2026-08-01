import { SupplierType } from '@prisma/client';
import {
  RequiredEvidenceDefinition,
  getRequiredEvidenceDefinitions,
} from './supplier-evidence-catalog';
import {
  EvidenceChecklistItem,
  EvidenceChecklistResult,
} from './supplier-evidence.types';
import { resolveSupplierJurisdictionCode } from './supplier-jurisdiction.constants';

export type SupplierEvidenceDocumentRow = {
  id: string;
  type: string;
  fileName: string;
  expiryDate: Date | null;
  uploadedAt: Date;
};

function isExpired(expiryDate: Date | null | undefined, now: Date): boolean {
  if (!expiryDate) return false;
  return expiryDate.getTime() < now.getTime();
}

function evaluateItem(
  def: RequiredEvidenceDefinition,
  docs: SupplierEvidenceDocumentRow[],
  now: Date,
): EvidenceChecklistItem {
  const sorted = [...docs].sort(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
  );

  const valid = sorted.find((d) => !isExpired(d.expiryDate, now));
  const latest = sorted[0];

  if (valid) {
    return {
      type: def.type,
      label: def.label,
      description: def.description,
      requiresExpiry: def.requiresExpiry,
      status: 'PRESENT',
      documentId: valid.id,
      fileName: valid.fileName,
      expiryDate: valid.expiryDate?.toISOString() ?? null,
      uploadedAt: valid.uploadedAt.toISOString(),
    };
  }

  if (latest && isExpired(latest.expiryDate, now)) {
    return {
      type: def.type,
      label: def.label,
      description: def.description,
      requiresExpiry: def.requiresExpiry,
      status: 'EXPIRED',
      documentId: latest.id,
      fileName: latest.fileName,
      expiryDate: latest.expiryDate?.toISOString() ?? null,
      uploadedAt: latest.uploadedAt.toISOString(),
    };
  }

  return {
    type: def.type,
    label: def.label,
    description: def.description,
    requiresExpiry: def.requiresExpiry,
    status: 'MISSING',
    documentId: null,
    fileName: null,
    expiryDate: null,
    uploadedAt: null,
  };
}

/** Pure evidence checklist evaluation (shared by portal, approvals, and PDP). */
export function buildSupplierEvidenceChecklist(
  supplierId: string,
  supplierType: SupplierType,
  jurisdictionCode: ReturnType<typeof resolveSupplierJurisdictionCode>,
  documents: SupplierEvidenceDocumentRow[],
  now = new Date(),
): EvidenceChecklistResult {
  const required = getRequiredEvidenceDefinitions(jurisdictionCode, supplierType);
  const byType = new Map<string, SupplierEvidenceDocumentRow[]>();

  for (const doc of documents) {
    const list = byType.get(doc.type) ?? [];
    list.push(doc);
    byType.set(doc.type, list);
  }

  const items: EvidenceChecklistItem[] = required.map((def) =>
    evaluateItem(def, byType.get(def.type) ?? [], now),
  );

  const missingCount = items.filter((i) => i.status === 'MISSING').length;
  const expiredCount = items.filter((i) => i.status === 'EXPIRED').length;

  return {
    supplierId,
    supplierType,
    jurisdictionCode,
    complete: missingCount === 0 && expiredCount === 0,
    items,
    missingCount,
    expiredCount,
  };
}
