export type DashboardPayload = {
  organizationId: string;
  workforceMigrationCutoverAt: string | null;
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
    workersImported: number;
    workersMatched: number;
    workersNew: number;
    workersFailed: number;
    stagingBacklog: number;
  };
  correlationTelemetry: {
    highConfidenceMatches: number;
    lowConfidenceMatches: number;
    manualReviewRequired: number;
    correlationConflicts: number;
    unlinkedWorkers: number;
  };
  governanceTelemetry: {
    pendingVerificationContractors: number;
    activeContractors: number;
    blockedContractors: number;
    terminatedUpstreamButActive: number;
    missingResponsibleManagerCount: number;
    missingSupplierLinks: number;
    workersBlockedPendingSupplierTrust: number;
    workersBlockedSuspendedSupplier: number;
    workersAssessed: number;
    workersNotReadyUnique: number;
    readinessReasonsDetected: number;
    duplicateWorkerCount: number;
  };
  operationalRiskTelemetry: {
    staleConnectorCount: number;
    failedSyncRuns: number;
    checkpointGapCount: number;
    identityConflictCount: number;
  };
  operationalWorkforceTelemetry: {
    populationScope?: string;
    registryTotal?: number;
    operationallyReady: number;
    blocked: number;
    restricted: number;
    suspendedInactive: number;
    exited: number;
  };
  driftSummary: {
    critical: number;
    high: number;
    underReview: number;
    openTotal: number;
    criticalUnresolvedOver24h: number;
    lifecycleConflictOpen: number;
    missingResponsibleManagerOpen: number;
    identityConflictOpen: number;
    supplierLinkMissingOpen: number;
  };
  remediationSummary: {
    populationScope?: string;
    activeRemediations: number;
    criticalUnresolved: number;
    pdpRestrictionsActive: number;
    escalationsOverdue: number;
    missingResponsibleManagerGovernanceOpen: number;
  };
  recentSyncRuns: Array<{
    id: string;
    status: string;
    mode: string;
    startedAt: string;
    durationMs: number | null;
    importedCount: number;
    correlationFailures: number;
    failedCount: number;
  }>;
  workforceAssessment: {
    lifecyclePhase: 'DISCOVERY_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT';
    canRunAssessment: boolean;
    latestDiscoveryRun: {
      id: string;
      snapshotRef: string;
      importedCount: number;
      finishedAt: string;
    } | null;
    lastAssessment: {
      discoveryRunId: string;
      snapshotRef: string;
      assessedAt: string;
    } | null;
    findingsSnapshotRef: string | null;
  };
  discoverySnapshotHistory: DiscoverySnapshotHistoryItem[];
};

export type DiscoverySnapshotHistoryItem = {
  id: string;
  snapshotRef: string;
  createdAt: string;
  source: string;
  status: string;
  workersDiscovered: number;
  newWorkers: number;
  updatedWorkers: number;
  unchangedWorkers: number;
  failedWorkers: number;
  discoveryExceptions: number;
  assessmentLabel: 'Pending' | 'Assessed' | 'Not assessed';
  isLatest: boolean;
};

export type DriftRow = {
  id: string;
  driftType: string;
  driftTypeLabel?: string;
  severity: string;
  status: string;
  sourcePersonId: string | null;
  signalCategory: string;
  signalLifecycleState?: string;
  ageHours?: number;
};

export type RemediationRow = {
  id: string;
  remediationType: string;
  remediationTypeLabel?: string;
  remediationStatus: string;
  pdpRestrictionsApplied: boolean;
  driftType?: string;
  driftTypeLabel?: string;
  escalationLevel: number;
  contractorId: string | null;
  driftSeverity?: string;
  ageHours?: number;
  isOverdue?: boolean;
  policyDecision?: string;
  policyEvaluationReason?: string;
  policySourceTruth?: string;
  policyResolutionAction?: string;
  policyEvaluationSteps?: Array<{
    capability: string;
    status: 'PASS' | 'FAIL';
    finding?: string;
  }>;
};

export type WorkforceImportTabId = 'overview' | 'history' | 'governance' | 'reconciliation' | 'cutover';

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

export function sortDriftRows(rows: DriftRow[]): DriftRow[] {
  return [...rows].sort((a, b) => {
    const aIsBootstrap = a.signalCategory === 'BOOTSTRAP' ? 1 : 0;
    const bIsBootstrap = b.signalCategory === 'BOOTSTRAP' ? 1 : 0;
    return aIsBootstrap - bIsBootstrap;
  });
}

export function isPastCutover(cutoverAt: string | null): boolean {
  if (!cutoverAt) return false;
  return Date.now() > new Date(cutoverAt).getTime();
}
