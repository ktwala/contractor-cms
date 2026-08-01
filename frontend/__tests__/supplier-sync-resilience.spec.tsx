import { render, screen } from '@testing-library/react';
import { SupplierSyncGovernanceTab } from '@/components/supplier-sources/supplier-sync/SupplierSyncGovernanceTab';
import { normalizeSupplierSyncDashboard } from '@/components/supplier-sources/supplier-sync/types';

jest.mock('@/lib/api', () => ({
  api: {
    getSuppliers: jest.fn().mockResolvedValue({ data: [] }),
    listSupplierReconciliationWorkItems: jest.fn().mockResolvedValue([]),
    completeMtnDemoStory: jest.fn(),
  },
}));

const minimalDashboard = normalizeSupplierSyncDashboard({
  organizationId: 'org-1',
  supplierSyncAssessment: {
    lifecyclePhase: 'ASSESSMENT_CURRENT',
    canRunAssessment: false,
    latestSyncRun: {
      id: 'run-1',
      snapshotRef: 'SYNC-00001',
      importedCount: 5,
      finishedAt: '2026-07-06T12:00:00.000Z',
    },
    lastAssessment: {
      syncRunId: 'run-1',
      snapshotRef: 'SYNC-00001',
      assessedAt: '2026-07-06T12:05:00.000Z',
    },
    findingsSnapshotRef: 'SYNC-00001',
  },
});

describe('supplier sync tab resilience', () => {
  it('governance tab renders when governanceTelemetry is missing', () => {
    render(
      <SupplierSyncGovernanceTab
        dashboard={
          {
            organizationId: 'org-1',
            governanceBuckets: { synced: 0, active: 0 },
            oracleLinkedTotal: 0,
            supplierSyncAssessment: {
              lifecyclePhase: 'ASSESSMENT_CURRENT',
              canRunAssessment: false,
              latestSyncRun: null,
              lastAssessment: null,
              findingsSnapshotRef: 'SYNC-00001',
            },
          } as never
        }
        canSync={false}
        canRunAssessment={false}
        detecting={false}
        onAssess={() => undefined}
        canOpenApprovalsQueue={false}
        canAssignPortalMembership={false}
      />,
    );
    expect(screen.getByTestId('supplier-sync-tab-panel-governance')).toBeInTheDocument();
  });

  it('normalize handles null anomalies', () => {
    const normalized = normalizeSupplierSyncDashboard({
      organizationId: 'org-1',
      anomalies: null as never,
    });
    expect(normalized.anomalies.anomalies).toEqual([]);
  });
});
