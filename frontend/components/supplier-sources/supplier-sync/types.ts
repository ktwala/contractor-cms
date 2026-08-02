export type DashboardPayload = {
  organizationId: string;
  connectorHealth: {
    health: string;
    restEnabled: boolean;
    lastSuccessfulSyncAt: string | null;
    lastError: string | null;
    isStale: boolean;
    staleThresholdHours: number;
  };
  syncTelemetry: {
    totalSyncRuns: number;
    successfulSyncRuns: number;
    failedSyncRuns: number;
    partialSyncRuns: number;
    lastSyncDurationMs: number | null;
    recordsImported: number;
    recordsMatched: number;
    recordsNew: number;
    recordsFailed: number;
    stagingBacklogCount: number;
  };
  governanceTelemetry: {
    pendingEvidenceSuppliers: number;
    unresolvedPossibleMatches: number;
    reconciliationFailures: number;
    promotionQueueAgeHours: number | null;
  };
  governanceBuckets: {
    synced: number;
    pendingEvidence?: number;
    active: number;
    suspended?: number;
  };
  oracleLinkedTotal: number;
  anomalies: {
    anomalies: Array<{
      code: string;
      severity: string;
      message: string;
      count: number;
    }>;
    totalAnomalyCount: number;
    organizationId: string;
    evaluatedAt: string;
  };
  driftSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    underReview: number;
    openTotal: number;
    criticalUnresolvedOver72h: number;
  };
  recentSyncRuns: Array<{
    id: string;
    status: string;
    mode: string;
    startedAt: string;
    durationMs: number | null;
    importedCount: number;
    failedCount: number;
  }>;
  supplierSyncAssessment: {
    lifecyclePhase: 'SYNCHRONIZATION_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT';
    canRunAssessment: boolean;
    latestSyncRun: {
      id: string;
      snapshotRef: string;
      importedCount: number;
      finishedAt: string;
    } | null;
    lastAssessment: {
      syncRunId: string;
      snapshotRef: string;
      assessedAt: string;
    } | null;
    findingsSnapshotRef: string | null;
  };
  supplierDiscoverySnapshotHistory?: SupplierDiscoverySnapshotHistoryItem[];
};

export type SupplierDiscoverySnapshotHistoryItem = {
  id: string;
  snapshotRef: string;
  createdAt: string;
  source: string;
  status: string;
  suppliersDiscovered: number;
  newSuppliers: number;
  matchedSuppliers: number;
  unchangedSuppliers: number;
  failedSuppliers: number;
  discoveryExceptions: number;
  assessmentLabel: 'Pending' | 'Assessed' | 'Not assessed';
  isLatest: boolean;
};

export type DriftRow = {
  id: string;
  driftType: string;
  severity: string;
  status: string;
  externalSupplierId: string | null;
  ageHours?: number;
};

export type SupplierSyncTabId = 'overview' | 'history' | 'governance';

const EMPTY_DRIFT_SUMMARY: DashboardPayload['driftSummary'] = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  underReview: 0,
  openTotal: 0,
  criticalUnresolvedOver72h: 0,
};

const EMPTY_GOVERNANCE_TELEMETRY: DashboardPayload['governanceTelemetry'] = {
  pendingEvidenceSuppliers: 0,
  unresolvedPossibleMatches: 0,
  reconciliationFailures: 0,
  promotionQueueAgeHours: null,
};

const EMPTY_GOVERNANCE_BUCKETS: DashboardPayload['governanceBuckets'] = {
  synced: 0,
  pendingEvidence: 0,
  active: 0,
  suspended: 0,
};

/** Defensive defaults — reconciliation tab must never crash on partial API payloads. */
export function normalizeSupplierSyncDashboard(
  raw: Partial<DashboardPayload> & { organizationId?: string },
): DashboardPayload {
  const organizationId = raw.organizationId ?? '';
  const anomaliesRoot = raw.anomalies as
    | DashboardPayload['anomalies']
    | DashboardPayload['anomalies']['anomalies']
    | undefined;

  const anomalyItems = Array.isArray(anomaliesRoot)
    ? anomaliesRoot
    : Array.isArray(anomaliesRoot?.anomalies)
      ? anomaliesRoot.anomalies
      : [];

  return {
    organizationId,
    connectorHealth: raw.connectorHealth ?? {
      health: 'UNKNOWN',
      restEnabled: false,
      lastSuccessfulSyncAt: null,
      lastError: null,
      isStale: false,
      staleThresholdHours: 24,
    },
    syncTelemetry: raw.syncTelemetry ?? {
      totalSyncRuns: 0,
      successfulSyncRuns: 0,
      failedSyncRuns: 0,
      partialSyncRuns: 0,
      lastSyncDurationMs: null,
      recordsImported: 0,
      recordsMatched: 0,
      recordsNew: 0,
      recordsFailed: 0,
      stagingBacklogCount: 0,
    },
    governanceTelemetry: raw.governanceTelemetry ?? EMPTY_GOVERNANCE_TELEMETRY,
    governanceBuckets: raw.governanceBuckets ?? EMPTY_GOVERNANCE_BUCKETS,
    oracleLinkedTotal: raw.oracleLinkedTotal ?? 0,
    anomalies: {
      anomalies: anomalyItems,
      totalAnomalyCount:
        typeof (raw.anomalies as DashboardPayload['anomalies'])?.totalAnomalyCount ===
        'number'
          ? (raw.anomalies as DashboardPayload['anomalies']).totalAnomalyCount
          : anomalyItems.reduce((sum, item) => sum + (item.count ?? 0), 0),
      organizationId,
      evaluatedAt:
        (raw.anomalies as DashboardPayload['anomalies'])?.evaluatedAt ??
        new Date().toISOString(),
    },
    driftSummary: raw.driftSummary ?? EMPTY_DRIFT_SUMMARY,
    recentSyncRuns: raw.recentSyncRuns ?? [],
    supplierSyncAssessment: raw.supplierSyncAssessment ?? {
      lifecyclePhase: 'SYNCHRONIZATION_PENDING',
      canRunAssessment: false,
      latestSyncRun: null,
      lastAssessment: null,
      findingsSnapshotRef: null,
    },
    supplierDiscoverySnapshotHistory: raw.supplierDiscoverySnapshotHistory,
  };
}

export function healthBadgeClass(health: string): string {
  switch (health) {
    case 'HEALTHY':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'STALE':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'DEGRADED':
    case 'RATE_LIMITED':
      return 'bg-orange-100 text-orange-900 border-orange-200';
    case 'AUTH_FAILED':
      return 'bg-red-100 text-red-900 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`;
}
