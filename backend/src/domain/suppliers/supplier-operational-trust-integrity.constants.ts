/** Business truths — Supplier Governance constitution (not implementation rules). */
export const SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS = [
  {
    id: 'OPERATIONAL_WORKER_REQUIRES_GRANTED_TRUST',
    name: 'Operational worker requires granted trust',
    businessTruth: 'Operational worker ⇒ Supplier Operational Trust = Granted',
  },
  {
    id: 'SUSPENDED_SUPPLIER_HAS_NO_OPERATIONAL_WORKERS',
    name: 'Suspended supplier has no operational workers',
    businessTruth: 'Supplier Operational Trust = Suspended ⇒ Operational workers = 0',
  },
  {
    id: 'PENDING_SUPPLIER_HAS_NO_OPERATIONAL_WORKERS',
    name: 'Pending supplier has no operational workers',
    businessTruth: 'Supplier Operational Trust = Pending ⇒ Operational workers = 0',
  },
  {
    id: 'GRANTED_TRUST_REQUIRES_ORACLE_SNAPSHOT',
    name: 'Granted trust requires Oracle synchronization snapshot',
    businessTruth: 'Operational Trust Granted ⇒ Supplier exists in Oracle synchronization snapshot',
  },
  {
    id: 'REMOVED_FROM_ORACLE_CANNOT_RETAIN_GRANTED_TRUST',
    name: 'Removed from Oracle cannot retain granted trust',
    businessTruth: 'Supplier removed from Oracle ⇒ Operational Trust cannot remain Granted indefinitely',
  },
] as const;

export type SupplierGovernanceIntegrityInvariantId =
  (typeof SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS)[number]['id'];

export type SupplierGovernanceIntegrityStatus = 'PASS' | 'FAIL';

export const SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT = 20;
