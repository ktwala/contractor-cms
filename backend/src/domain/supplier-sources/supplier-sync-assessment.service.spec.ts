import { SupplierSyncAssessmentService } from './supplier-sync-assessment.service';
import {
  formatSupplierSyncSnapshotRef,
  supplierSyncSnapshotSequenceFromRuns,
} from './supplier-sync-snapshot.util';

describe('SupplierSyncAssessmentService', () => {
  const organizationId = 'org-1';

  let service: SupplierSyncAssessmentService;
  let prisma: {
    organization: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    supplierSourceSyncRun: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      supplierSourceSyncRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new SupplierSyncAssessmentService(prisma as never);
  });

  it('returns SYNCHRONIZATION_PENDING when no successful sync run exists', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      supplierLastAssessedSyncRunId: null,
      supplierLastAssessedAt: null,
    });
    prisma.supplierSourceSyncRun.findFirst.mockResolvedValue(null);
    prisma.supplierSourceSyncRun.findMany.mockResolvedValue([]);

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('SYNCHRONIZATION_PENDING');
    expect(status.canRunAssessment).toBe(false);
  });

  it('returns ASSESSMENT_PENDING when sync exists but has not been assessed', async () => {
    const finishedAt = new Date('2026-07-02T12:00:00.000Z');
    prisma.organization.findUnique.mockResolvedValue({
      supplierLastAssessedSyncRunId: null,
      supplierLastAssessedAt: null,
    });
    prisma.supplierSourceSyncRun.findFirst.mockResolvedValue({
      id: 'run-2',
      importedCount: 8,
      finishedAt,
    });
    prisma.supplierSourceSyncRun.findMany.mockResolvedValue([
      { id: 'run-1' },
      { id: 'run-2' },
    ]);

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('ASSESSMENT_PENDING');
    expect(status.canRunAssessment).toBe(true);
    expect(status.latestSyncRun?.snapshotRef).toBe('SYNC-00002');
  });

  it('returns ASSESSMENT_CURRENT when latest sync was assessed', async () => {
    const finishedAt = new Date('2026-07-02T12:00:00.000Z');
    prisma.organization.findUnique.mockResolvedValue({
      supplierLastAssessedSyncRunId: 'run-2',
      supplierLastAssessedAt: new Date('2026-07-02T12:05:00.000Z'),
    });
    prisma.supplierSourceSyncRun.findMany.mockResolvedValue([
      { id: 'run-1' },
      { id: 'run-2' },
    ]);
    prisma.supplierSourceSyncRun.findFirst.mockImplementation(
      ({ where }: { where?: { id?: string } }) => {
        if (where?.id === 'run-2') {
          return Promise.resolve({
            id: 'run-2',
            importedCount: 8,
            finishedAt,
            status: 'SUCCEEDED',
          });
        }
        return Promise.resolve({
          id: 'run-2',
          importedCount: 8,
          finishedAt,
        });
      },
    );

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('ASSESSMENT_CURRENT');
    expect(status.canRunAssessment).toBe(false);
    expect(status.findingsSnapshotRef).toBe('SYNC-00002');
  });

  it('listSnapshotHistory returns per-run supplier snapshots with assessment labels', async () => {
    const finishedAt = new Date('2026-07-02T12:00:00.000Z');
    prisma.organization.findUnique.mockResolvedValue({
      supplierLastAssessedSyncRunId: null,
    });
    prisma.supplierSourceSyncRun.findMany.mockImplementation(
      ({ orderBy }: { orderBy?: { finishedAt?: string } }) => {
        if (orderBy?.finishedAt === 'asc') {
          return Promise.resolve([{ id: 'run-1' }]);
        }
        return Promise.resolve([
          {
            id: 'run-1',
            status: 'SUCCEEDED',
            finishedAt,
            importedCount: 2,
            matchedCount: 0,
            newCount: 2,
            failedCount: 0,
          },
        ]);
      },
    );

    const history = await service.listSnapshotHistory(organizationId);

    expect(history).toHaveLength(1);
    expect(history[0].snapshotRef).toBe('SYNC-00001');
    expect(history[0].source).toBe('Oracle Supplier Portal');
    expect(history[0].suppliersDiscovered).toBe(2);
    expect(history[0].failedSuppliers).toBe(0);
    expect(history[0].discoveryExceptions).toBe(0);
    expect(history[0].assessmentLabel).toBe('Pending');
    expect(history[0].isLatest).toBe(true);
  });
});

describe('supplier-sync-snapshot.util', () => {
  it('formats snapshot refs in sequence order', () => {
    expect(formatSupplierSyncSnapshotRef(15)).toBe('SYNC-00015');
    expect(
      supplierSyncSnapshotSequenceFromRuns(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        'b',
      ),
    ).toBe(2);
  });
});
