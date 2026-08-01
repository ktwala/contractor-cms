/**
 * hcm-migration-lineage-toggle.spec.tsx
 * PR-CMS-LINEAGE-1 — Render-level test for the "Show migration lineage" toggle.
 *
 * Verifies that:
 * - The toggle starts OFF (operational-only view)
 * - Toggling ON passes operationalOnly=false to the API
 * - Bootstrap rows appear only when migration lineage is shown
 * - Operational rows appear in both views
 * - The cutover banner is rendered
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import HcmConnectorOperationsPanel from '../components/contractor-sources/HcmConnectorOperationsPanel';
import { api } from '../lib/api';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../lib/api', () => ({
  api: {
    getOracleHcmConnectorDashboard: jest.fn(),
    listOracleHcmSourceDrift: jest.fn(),
    listContractorGovernanceRemediation: jest.fn(),
    detectOracleHcmSourceDrift: jest.fn(),
    // WorkforceCutoverPanel is rendered inside HcmConnectorOperationsPanel;
    // stub this so the panel doesn't fail during lineage-toggle tests.
    getWorkforceCutover: jest.fn().mockResolvedValue({
      workforceMigrationCutoverAt: null,
      updatedAt: new Date().toISOString(),
      governancePhase: 'NO_CUTOVER',
    }),
  },
}));

jest.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    can: jest.fn().mockReturnValue(false),
    canAny: jest.fn().mockReturnValue(false),
    user: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../components/connector-sources/HcmConnectorDemoBar', () => ({
  HcmConnectorDemoBar: () => null,
}));

// Stub WorkforceCutoverPanel so lineage-toggle tests are not affected by
// its internal loading state — those tests are scoped to the toggle itself.
jest.mock('../components/contractor-sources/WorkforceCutoverPanel', () => ({
  __esModule: true,
  default: () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildDashboard(
  cutoverAt: string | null = null,
  assessmentPhase: 'DISCOVERY_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT' = 'ASSESSMENT_CURRENT',
) {
  return {
    organizationId: 'org-1',
    workforceMigrationCutoverAt: cutoverAt,
    connectorHealth: {
      health: 'HEALTHY',
      restEnabled: true,
      lastSuccessfulSyncAt: null,
      lastError: null,
      isStale: false,
      staleThresholdHours: 24,
    },
    syncTelemetry: {
      totalSyncRuns: 0,
      successfulSyncRuns: 0,
      failedSyncRuns: 0,
      partialSyncRuns: 0,
      lastSyncDurationMs: null,
      workersImported: 0,
      workersMatched: 0,
      workersNew: 0,
      workersFailed: 0,
      stagingBacklog: 0,
    },
    correlationTelemetry: {
      highConfidenceMatches: 0,
      lowConfidenceMatches: 0,
      manualReviewRequired: 2,
      correlationConflicts: 1,
      unlinkedWorkers: 3,
    },
    governanceTelemetry: {
      pendingVerificationContractors: 0,
      activeContractors: 6,
      blockedContractors: 0,
      terminatedUpstreamButActive: 0,
      missingResponsibleManagerCount: 1,
      missingSupplierLinks: 2,
      workersBlockedPendingSupplierTrust: 0,
      workersBlockedSuspendedSupplier: 0,
    },
    operationalRiskTelemetry: {
      staleConnectorCount: 0,
      failedSyncRuns: 0,
      checkpointGapCount: 0,
      identityConflictCount: 0,
    },
    driftSummary: {
      critical: 0,
      high: 0,
      underReview: 0,
      openTotal: 0,
      criticalUnresolvedOver24h: 0,
      lifecycleConflictOpen: 0,
      missingResponsibleManagerOpen: 0,
      identityConflictOpen: 0,
      supplierLinkMissingOpen: 0,
    },
    remediationSummary: {
      activeRemediations: 0,
      criticalUnresolved: 0,
      pdpRestrictionsActive: 0,
      escalationsOverdue: 0,
      missingResponsibleManagerGovernanceOpen: 0,
    },
    operationalWorkforceTelemetry: {
      populationScope: 'Materialized HCM contractors in the CMS workforce registry',
      registryTotal: 6,
      operationallyReady: 6,
      blocked: 0,
      restricted: 0,
      suspendedInactive: 0,
      exited: 0,
    },
    recentSyncRuns: [],
    workforceAssessment: {
      lifecyclePhase: assessmentPhase,
      canRunAssessment: assessmentPhase === 'ASSESSMENT_PENDING',
      latestDiscoveryRun: {
        id: 'run-1',
        snapshotRef: 'DISC-00001',
        importedCount: 10,
        finishedAt: new Date().toISOString(),
      },
      lastAssessment:
        assessmentPhase === 'ASSESSMENT_CURRENT'
          ? {
              discoveryRunId: 'run-1',
              snapshotRef: 'DISC-00001',
              assessedAt: new Date().toISOString(),
            }
          : null,
      findingsSnapshotRef: assessmentPhase === 'ASSESSMENT_CURRENT' ? 'DISC-00001' : null,
    },
    discoverySnapshotHistory: [
      {
        id: 'run-1',
        snapshotRef: 'DISC-00001',
        createdAt: new Date().toISOString(),
        source: 'Oracle HCM',
        status: 'SUCCEEDED',
        workersDiscovered: 10,
        newWorkers: 3,
        updatedWorkers: 6,
        unchangedWorkers: 1,
        failedWorkers: 0,
        discoveryExceptions: 0,
        assessmentLabel: assessmentPhase === 'ASSESSMENT_CURRENT' ? 'Assessed' : 'Pending',
        isLatest: true,
      },
    ],
  };
}

const operationalRow = {
  id: 'row-op-1',
  driftType: 'MISSING_RESPONSIBLE_MANAGER',
  severity: 'CRITICAL',
  status: 'OPEN',
  sourcePersonId: 'person-001',
  signalCategory: 'OPERATIONAL',
  ageHours: 5,
};

const bootstrapRow = {
  id: 'row-bs-1',
  driftType: 'WORKER_SOURCE_DRIFT',
  severity: 'LOW',
  status: 'OPEN',
  sourcePersonId: 'person-002',
  signalCategory: 'BOOTSTRAP',
  ageHours: 120,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupApiMocks({
  initialRows,
  rowsAfterToggle,
  cutoverAt = null,
  assessmentPhase = 'ASSESSMENT_CURRENT' as const,
}: {
  initialRows: any[];
  rowsAfterToggle: any[];
  cutoverAt?: string | null;
  assessmentPhase?: 'DISCOVERY_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT';
}) {
  const mockedDashboard = jest.mocked(api.getOracleHcmConnectorDashboard);
  const mockedDrift = jest.mocked(api.listOracleHcmSourceDrift);
  const mockedRemediation = jest.mocked(api.listContractorGovernanceRemediation);

  mockedDashboard.mockResolvedValue(buildDashboard(cutoverAt, assessmentPhase));
  mockedRemediation.mockResolvedValue({ data: [], total: 0, page: 1, limit: 15 });

  mockedDrift.mockImplementation(({ operationalOnly }: { operationalOnly?: boolean }) =>
    Promise.resolve({
      data: operationalOnly ? initialRows : rowsAfterToggle,
      total: operationalOnly ? initialRows.length : rowsAfterToggle.length,
      page: 1,
      limit: 15,
    }),
  );
}

async function goToTab(tab: 'overview' | 'history' | 'governance' | 'cutover') {
  fireEvent.click(screen.getByTestId(`workforce-import-tab-${tab}`));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HcmConnectorOperationsPanel — migration lineage toggle (render)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the cutover banner (no cutover date)', async () => {
    setupApiMocks({ initialRows: [], rowsAfterToggle: [] });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('cutover');

    await waitFor(() => {
      const banner = screen.getByTestId('cutover-banner');
      expect(banner).toBeInTheDocument();
      // NO_CUTOVER state wording (PR-GOV-SIGNAL-LIFECYCLE-2)
      expect(banner).toHaveTextContent('Bootstrap lineage visible');
      expect(banner).toHaveTextContent('workforce cutover not declared');
    });
  });

  it('renders post-cutover banner when cutover is in the past', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    setupApiMocks({ initialRows: [], rowsAfterToggle: [], cutoverAt: pastDate });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('cutover');

    await waitFor(() => {
      const banner = screen.getByTestId('cutover-banner');
      // POST_CUTOVER state wording (PR-GOV-SIGNAL-LIFECYCLE-2)
      expect(banner).toHaveTextContent('Post-cutover');
      expect(banner).toHaveTextContent('bootstrap lineage hidden by default');
    });
  });

  it('toggle button starts with aria-pressed=false (operational-only is default)', async () => {
    setupApiMocks({ initialRows: [operationalRow], rowsAfterToggle: [operationalRow, bootstrapRow] });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('cutover');

    await waitFor(() => {
      const toggle = screen.getByTestId('migration-lineage-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('initial load calls API with operationalOnly=true', async () => {
    setupApiMocks({ initialRows: [operationalRow], rowsAfterToggle: [operationalRow, bootstrapRow] });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(api.listOracleHcmSourceDrift).toHaveBeenCalledWith(
        expect.objectContaining({ operationalOnly: true }),
      );
    });
  });

  it('bootstrap rows are NOT visible in default operational view', async () => {
    setupApiMocks({ initialRows: [operationalRow], rowsAfterToggle: [] });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('governance');

    await waitFor(() => {
      expect(screen.queryByTestId('drift-row-bootstrap')).not.toBeInTheDocument();
      expect(screen.getByTestId('drift-row-operational')).toBeInTheDocument();
    });
  });

  it('toggling ON calls API with operationalOnly=false and shows bootstrap rows', async () => {
    setupApiMocks({
      initialRows: [operationalRow],
      rowsAfterToggle: [operationalRow, bootstrapRow],
    });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('cutover');

    // Click the toggle
    const toggle = screen.getByTestId('migration-lineage-toggle');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(api.listOracleHcmSourceDrift).toHaveBeenCalledWith(
        expect.objectContaining({ operationalOnly: false }),
      );
    });

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('drift-row-bootstrap')).toBeInTheDocument();
      // Bootstrap badge should appear
      expect(screen.getByTestId('bootstrap-lineage-badge')).toBeInTheDocument();
    });
  });

  it('operational rows appear before bootstrap rows in the table', async () => {
    // Deliberately return bootstrap row FIRST from API (wrong order)
    // — sortDriftRows() must reorder them
    setupApiMocks({
      initialRows: [operationalRow],
      rowsAfterToggle: [bootstrapRow, operationalRow],
    });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });
    goToTab('cutover');

    fireEvent.click(screen.getByTestId('migration-lineage-toggle'));

    await waitFor(() => {
      const opRows = screen.getAllByTestId('drift-row-operational');
      const bsRows = screen.getAllByTestId('drift-row-bootstrap');
      expect(opRows.length).toBeGreaterThan(0);
      expect(bsRows.length).toBeGreaterThan(0);

      // Operational row should appear before bootstrap row in the DOM
      const allRows = screen.getAllByRole('row');
      const opIndex = allRows.findIndex((r) => r.dataset['testid'] === 'drift-row-operational');
      const bsIndex = allRows.findIndex((r) => r.dataset['testid'] === 'drift-row-bootstrap');
      expect(opIndex).toBeLessThan(bsIndex);
    });
  });

  it('keeps Overview discovery-only and places readiness on Governance', async () => {
    setupApiMocks({ initialRows: [], rowsAfterToggle: [] });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tab-panel-overview')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('governance-snapshot')).not.toBeInTheDocument();
    expect(screen.getByTestId('latest-workforce-snapshot')).toBeInTheDocument();

    goToTab('governance');

    await waitFor(() => {
      expect(screen.getByTestId('workforce-readiness-section')).toBeInTheDocument();
    });
  });

  it('hides assessment-derived governance outputs before workforce assessment runs', async () => {
    setupApiMocks({
      initialRows: [],
      rowsAfterToggle: [],
      assessmentPhase: 'ASSESSMENT_PENDING',
    });

    render(<HcmConnectorOperationsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });

    goToTab('governance');

    await waitFor(() => {
      expect(screen.getByTestId('workforce-assessment-status-section')).toBeInTheDocument();
      expect(screen.getByTestId('workforce-readiness-section')).toBeInTheDocument();
      expect(screen.getByText('Awaiting assessment')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('correlation-governance-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('governance-lifecycle-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('governance-remediation-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('operational-risk-section')).not.toBeInTheDocument();
    expect(screen.getByText('Assessment has not yet been run.')).toBeInTheDocument();
    expect(screen.queryByTestId('drift-summary-missing-supplier')).not.toBeInTheDocument();
  });

  it('shows readiness reasons and operational states after assessment', async () => {
    setupApiMocks({
      initialRows: [],
      rowsAfterToggle: [],
      assessmentPhase: 'ASSESSMENT_CURRENT',
    });

    render(<HcmConnectorOperationsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('workforce-import-tabs')).toBeInTheDocument();
    });

    goToTab('governance');

    await waitFor(() => {
      expect(screen.getByTestId('workforce-drift-section')).toBeInTheDocument();
      expect(screen.getByTestId('workforce-readiness-section')).toBeInTheDocument();
      expect(screen.getAllByText('Missing supplier').length).toBeGreaterThan(0);
      expect(screen.getByText('Manual review')).toBeInTheDocument();
      expect(screen.getByTestId('governance-lifecycle-section')).toBeInTheDocument();
      expect(screen.getByText('Operationally ready')).toBeInTheDocument();
      expect(screen.getByText('Restricted')).toBeInTheDocument();
      expect(screen.getByTestId('governance-remediation-section')).toBeInTheDocument();
      expect(screen.getByText('Resolution')).toBeInTheDocument();
      expect(screen.queryByText('High confidence')).not.toBeInTheDocument();
    });
  });
});
