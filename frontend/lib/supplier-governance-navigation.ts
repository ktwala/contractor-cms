import {
  isOracleSupplierAuthority,
  type TenantAuthorityProfile,
} from '@/lib/tenant-authority';

export type SupplierGovernanceBucketKey =
  | 'synced'
  | 'pendingEvidence'
  | 'active'
  | 'suspended';

export function supplierGovernanceBucketHref(
  bucket: SupplierGovernanceBucketKey,
  tenantAuthority?: TenantAuthorityProfile | null,
): string {
  switch (bucket) {
    case 'synced':
      return '/suppliers?governanceBucket=synced';
    case 'active':
      return '/suppliers?governanceBucket=active';
    case 'suspended':
      return '/suppliers?governanceBucket=suspended';
    case 'pendingEvidence':
      if (isOracleSupplierAuthority(tenantAuthority)) {
        return '/suppliers/approvals';
      }
      return '/suppliers/approvals?evidenceIncomplete=true';
    default:
      return '/suppliers';
  }
}

export function supplierGovernanceBucketLabel(
  bucket: SupplierGovernanceBucketKey,
  tenantAuthority?: TenantAuthorityProfile | null,
): string {
  if (bucket === 'pendingEvidence' && isOracleSupplierAuthority(tenantAuthority)) {
    return 'Operational Trust Pending';
  }
  const labels: Record<SupplierGovernanceBucketKey, string> = {
    synced: 'Synchronized',
    pendingEvidence: 'Operational Trust Pending',
    active: 'Operational Trust Granted',
    suspended: 'Operational Trust Suspended',
  };
  return labels[bucket];
}

export function supplierGovernanceBucketHint(
  bucket: SupplierGovernanceBucketKey,
  tenantAuthority?: TenantAuthorityProfile | null,
): string {
  switch (bucket) {
    case 'synced':
      return 'Oracle-linked suppliers with an external workforce governance record';
    case 'pendingEvidence':
      return isOracleSupplierAuthority(tenantAuthority)
        ? 'Awaiting Operational Trust — procurement approval inherited from Oracle'
        : 'Awaiting EWP readiness checks before Operational Trust';
    case 'active':
      return 'Operational Trust granted — supplier may participate in EWP';
    case 'suspended':
      return 'Governance hold applied in EWP';
    default:
      return '';
  }
}

export const SUPPLIER_GOVERNANCE_BUCKET_FILTER_LABELS: Record<string, string> = {
  synced: 'Oracle-linked · synchronized',
  pending_evidence: 'Oracle-linked · Operational Trust Pending',
  active: 'Oracle-linked · Operational Trust Granted',
  suspended: 'Oracle-linked · Operational Trust Suspended',
};
