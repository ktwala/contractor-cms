/**
 * Operational Trust — EWP platform concept (operator vocabulary).
 *
 * Oracle Supplier Portal approves suppliers to do business.
 * EWP grants Operational Trust so approved suppliers may participate in the platform.
 *
 * Queue = suppliers awaiting a pending decision.
 * Management = lifecycle for granted and suspended suppliers (suspend / restore).
 */
export const OPERATIONAL_TRUST_LABELS = {
  pageTitle: 'Operational Trust Queue',
  managementPageTitle: 'Operational Trust Management',
  navLabel: 'Operational trust queue',
  managementNavLabel: 'Operational trust management',
  queueSection: 'Operational trust queue',
  grantAction: 'Grant Operational Trust',
  restoreAction: 'Restore Operational Trust',
  denyAction: 'Suspend',
  suspendAction: 'Suspend Operational Trust',
  queueEmpty: 'No suppliers awaiting operational trust.',
  queueEmptyFootnote:
    'The queue only shows suppliers awaiting a pending decision. Suspended or granted suppliers are managed under Operational Trust Management.',
  queueIntro:
    'Grant Operational Trust to Oracle-approved suppliers so they can participate in the External Workforce Platform. Procurement approval remains managed in Oracle Supplier Portal.',
  queueIntroEvidenceBlocked:
    'Suppliers blocked on EWP readiness checks before Operational Trust can be granted.',
  managementIntro:
    'Manage Operational Trust for suppliers already reviewed. Suspend participation, restore it after governance review, or open the audit history for a supplier.',
  managementEmptyGranted: 'No suppliers with Operational Trust Granted.',
  managementEmptySuspended: 'No suppliers with Operational Trust Suspended.',
  openQueue: 'Open Operational Trust Queue →',
  openManagement: 'Open Operational Trust Management →',
  openSupplier: 'Open supplier →',
  waitingForColumn: 'Waiting for',
  oracleColumn: 'Oracle Procurement',
  operationalTrustColumn: 'Operational Trust',
  affectedWorkersColumn: 'Workers affected by this decision',
  workersAffectedByOperationalTrust: 'Workers affected by Operational Trust',
  tileGranted: 'Operational Trust Granted',
  tilePending: 'Operational Trust Pending',
  tileSuspended: 'Operational Trust Suspended',
  granted: 'Operational Trust Granted',
  pending: 'Operational Trust Pending',
  suspended: 'Operational Trust Suspended',
  oracleApproved: 'Approved',
  evidenceInherited: 'Inherited from Oracle Supplier Portal',
  afterGrantResult: 'Supplier may participate in the External Workforce Platform.',
  afterRestoreResult: 'Supplier may participate in EWP again.',
  lastDecisionColumn: 'Last decision',
  supplierGovernanceFindingTitle: 'Supplier Governance Finding',
  supplierGovernanceImpactSectionTitle: 'Supplier Governance Impact',
  impactColumn: 'Impact',
  resolutionColumn: 'Resolution',
  workerBlockTitle: 'Cannot operationalize worker',
  workerBlockSupplierActionRequired: 'Supplier action required',
  formatAffectedWorkerCount: (count: number) => String(count),
  workerBlockTrustNotGranted: 'Supplier Operational Trust not granted',
  workerBlockActionGrant: 'Grant Operational Trust',
  workerBlockActionRestore: 'Restore Operational Trust',
  workerBlockResolvePrefix: 'Resolve under Supplier Administration →',
  workersBlockedPendingTrust: 'Pending supplier decision',
  workersBlockedSuspendedSupplier: 'Suspended supplier',
  operationalTrustFindings: 'Operational Trust findings',
  evidenceSectionTitle: 'Operational Trust',
  evidenceEmpty: 'No Operational Trust decisions recorded yet.',
} as const;

export const OPERATIONAL_TRUST_NARRATIVE = {
  gatewayRule:
    'Operational Trust is the gateway between Supplier Governance and Workforce Governance. A supplier cannot nominate or onboard external workers until Operational Trust has been granted by EWP.',
  horizonWaitingReason:
    'Supplier is approved in Oracle Procurement but has not yet been enabled for participation in the External Workforce Platform.',
  requiredAction: 'Grant Operational Trust',
  assuranceQuestion:
    'Is every operational worker employed by a supplier with Operational Trust?',
  queueVsManagement:
    'The Operational Trust Queue holds pending decisions. Operational Trust Management governs granted and suspended suppliers.',
} as const;

export const OPERATIONAL_TRUST_ROUTES = {
  queue: '/suppliers/approvals',
  management: '/suppliers/operational-trust',
  managementSuspended: '/suppliers/operational-trust?status=SUSPENDED',
  managementGranted: '/suppliers/operational-trust?status=ACTIVE',
  supplier: (supplierId: string) => `/suppliers/${supplierId}`,
} as const;

/** Oracle-linked suppliers synchronized from Supplier Portal are procurement-approved. */
export function oracleProcurementLabel(externalSupplierId?: string | null): string {
  return externalSupplierId ? OPERATIONAL_TRUST_LABELS.oracleApproved : '—';
}

export function operationalTrustLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return OPERATIONAL_TRUST_LABELS.granted;
    case 'PENDING_APPROVAL':
      return OPERATIONAL_TRUST_LABELS.pending;
    case 'SUSPENDED':
      return OPERATIONAL_TRUST_LABELS.suspended;
    default:
      return 'Operational Trust not evaluated';
  }
}

export function operationalTrustBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'PENDING_APPROVAL':
      return 'bg-amber-100 text-amber-800';
    case 'SUSPENDED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function isOperationalTrustGranted(status: string): boolean {
  return status === 'ACTIVE';
}

export function operationalTrustResolutionHref(supplierStatus: string): string {
  if (supplierStatus === 'PENDING_APPROVAL') {
    return OPERATIONAL_TRUST_ROUTES.queue;
  }
  if (supplierStatus === 'SUSPENDED') {
    return OPERATIONAL_TRUST_ROUTES.managementSuspended;
  }
  return OPERATIONAL_TRUST_ROUTES.management;
}

export function operationalTrustResolutionLinkLabel(supplierStatus: string): string {
  if (supplierStatus === 'PENDING_APPROVAL') {
    return `${OPERATIONAL_TRUST_LABELS.workerBlockResolvePrefix} Operational Trust Queue`;
  }
  return `${OPERATIONAL_TRUST_LABELS.workerBlockResolvePrefix} Operational Trust Management`;
}

export function buildOperationalTrustWorkerBlock(input: {
  supplierName: string;
  supplierStatus: string;
  blockedWorkerCount?: number;
}): {
  heading: string;
  supplierName: string;
  operationalTrustLabel: string;
  workersBlockedLabel: string | null;
  action: string;
  resolutionHref: string;
  resolutionLinkLabel: string;
} {
  const isSuspended = input.supplierStatus === 'SUSPENDED';
  return {
    heading: OPERATIONAL_TRUST_LABELS.workerBlockSupplierActionRequired,
    supplierName: input.supplierName,
    operationalTrustLabel: operationalTrustLabel(input.supplierStatus),
    workersBlockedLabel:
      input.blockedWorkerCount != null
        ? OPERATIONAL_TRUST_LABELS.formatAffectedWorkerCount(input.blockedWorkerCount)
        : null,
    action: isSuspended
      ? OPERATIONAL_TRUST_LABELS.workerBlockActionRestore
      : OPERATIONAL_TRUST_LABELS.workerBlockActionGrant,
    resolutionHref: operationalTrustResolutionHref(input.supplierStatus),
    resolutionLinkLabel: operationalTrustResolutionLinkLabel(input.supplierStatus),
  };
}

export function supplierSelectLabel(input: {
  name: string;
  status: string;
  externalSupplierId?: string | null;
}): string {
  if (input.status === 'ACTIVE') {
    return input.name;
  }
  return `${input.name} — ${operationalTrustLabel(input.status)}`;
}

export type OperationalTrustDecisionSummary = {
  kind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
  occurredAt: string;
  actorDisplayName?: string | null;
  reason?: string | null;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Compact Management-table label: "Restored today", "Granted 2 Jul". */
export function formatLastOperationalTrustDecision(
  decision: OperationalTrustDecisionSummary | null | undefined,
  now: Date = new Date(),
): string {
  if (!decision?.occurredAt) return '—';

  const verb =
    decision.kind === 'RESTORED'
      ? 'Restored'
      : decision.kind === 'GRANTED'
        ? 'Granted'
        : decision.kind === 'SUSPENDED'
          ? 'Suspended'
          : 'Denied';

  const occurred = new Date(decision.occurredAt);
  if (Number.isNaN(occurred.getTime())) return verb;

  const dayDiff = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(occurred).getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return `${verb} today`;
  if (dayDiff === 1) return `${verb} yesterday`;

  const day = occurred.getDate();
  const month = occurred.toLocaleString(undefined, { month: 'short' });
  if (occurred.getFullYear() === now.getFullYear()) {
    return `${verb} ${day} ${month}`;
  }
  return `${verb} ${day} ${month} ${occurred.getFullYear()}`;
}
