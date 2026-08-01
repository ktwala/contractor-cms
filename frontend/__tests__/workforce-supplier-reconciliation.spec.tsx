import { render, screen } from '@testing-library/react';
import { WorkforceImportReconciliationTab } from '@/components/contractor-sources/workforce-import/WorkforceImportReconciliationTab';
import { SupplierReferenceReconciliationQueue } from '@/components/contractor-sources/workforce-import/SupplierReferenceReconciliationQueue';

jest.mock('@/lib/api', () => ({
  api: {
    listSupplierReconciliationWorkItems: jest.fn().mockResolvedValue([]),
  },
}));

describe('workforce supplier reconciliation', () => {
  it('reconciliation tab renders after workforce assessment', () => {
    render(
      <WorkforceImportReconciliationTab
        dashboard={
          {
            organizationId: 'org-1',
            workforceAssessment: {
              lifecyclePhase: 'ASSESSMENT_CURRENT',
              canRunAssessment: false,
              latestDiscoveryRun: {
                id: 'run-1',
                snapshotRef: 'DISC-00001',
                importedCount: 40,
                finishedAt: '2026-07-06T12:00:00.000Z',
              },
              lastAssessment: {
                discoveryRunId: 'run-1',
                snapshotRef: 'DISC-00001',
                assessedAt: '2026-07-06T12:05:00.000Z',
              },
              findingsSnapshotRef: 'DISC-00001',
            },
          } as never
        }
      />,
    );
    expect(screen.getByTestId('workforce-import-tab-panel-reconciliation')).toBeInTheDocument();
    expect(screen.getByText(/Based on discovery snapshot DISC-00001/)).toBeInTheDocument();
  });

  it('supplier reference queue shows operator-facing table', async () => {
    const { api } = require('@/lib/api');
    api.listSupplierReconciliationWorkItems.mockResolvedValueOnce([
      {
        id: 'd1',
        referenceName: 'BlueSky Field Services',
        reconciliationKind: 'POSSIBLE_MATCH',
        proposedSupplierName: 'Vertex Projects',
        workerCount: 1,
        observationSource: 'ORACLE_HCM',
      },
      {
        id: 'd2',
        referenceName: 'Mandla Projects (Pty) Ltd',
        reconciliationKind: 'CONFLICT',
        proposedSupplierName: 'Atlas Consulting',
        workerCount: 1,
        observationSource: 'ORACLE_HCM',
      },
    ]);
    render(<SupplierReferenceReconciliationQueue />);
    expect(await screen.findByText('BlueSky Field Services')).toBeInTheDocument();
    expect(screen.getByText(/Possible match with "Vertex Projects"/)).toBeInTheDocument();
    expect(screen.getByText('Confirm supplier match')).toBeInTheDocument();
    expect(screen.getByText('Mandla Projects (Pty) Ltd')).toBeInTheDocument();
    expect(screen.getByText('No matching supplier in Oracle Supplier Portal')).toBeInTheDocument();
    expect(screen.getByText('Create or associate supplier')).toBeInTheDocument();
    expect(screen.getAllByText('Oracle HCM').length).toBeGreaterThan(0);
  });
});
