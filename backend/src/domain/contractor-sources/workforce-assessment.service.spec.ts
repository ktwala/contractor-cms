import { WorkforceAssessmentService } from './workforce-assessment.service';
import {
  discoverySnapshotSequenceFromRuns,
  formatDiscoverySnapshotRef,
} from './workforce-discovery-snapshot.util';

describe('WorkforceAssessmentService', () => {
  const organizationId = 'org-1';

  let service: WorkforceAssessmentService;
  let prisma: {
    organization: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    contractorSourceSyncRun: {
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
      contractorSourceSyncRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new WorkforceAssessmentService(prisma as never);
  });

  it('returns DISCOVERY_PENDING when no successful discovery run exists', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      workforceLastAssessedDiscoveryRunId: null,
      workforceLastAssessedAt: null,
    });
    prisma.contractorSourceSyncRun.findFirst.mockResolvedValue(null);
    prisma.contractorSourceSyncRun.findMany.mockResolvedValue([]);

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('DISCOVERY_PENDING');
    expect(status.canRunAssessment).toBe(false);
  });

  it('returns ASSESSMENT_PENDING when discovery exists but has not been assessed', async () => {
    const finishedAt = new Date('2026-07-02T12:00:00.000Z');
    prisma.organization.findUnique.mockResolvedValue({
      workforceLastAssessedDiscoveryRunId: null,
      workforceLastAssessedAt: null,
    });
    prisma.contractorSourceSyncRun.findFirst.mockResolvedValue({
      id: 'run-2',
      importedCount: 10,
      finishedAt,
    });
    prisma.contractorSourceSyncRun.findMany.mockResolvedValue([
      { id: 'run-1' },
      { id: 'run-2' },
    ]);

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('ASSESSMENT_PENDING');
    expect(status.canRunAssessment).toBe(true);
    expect(status.latestDiscoveryRun?.snapshotRef).toBe('DISC-00002');
  });

  it('returns ASSESSMENT_CURRENT when latest discovery was assessed', async () => {
    const finishedAt = new Date('2026-07-02T12:00:00.000Z');
    prisma.organization.findUnique.mockResolvedValue({
      workforceLastAssessedDiscoveryRunId: 'run-2',
      workforceLastAssessedAt: new Date('2026-07-02T12:05:00.000Z'),
    });
    prisma.contractorSourceSyncRun.findMany.mockResolvedValue([
      { id: 'run-1' },
      { id: 'run-2' },
    ]);
    prisma.contractorSourceSyncRun.findFirst.mockImplementation(
      ({ where }: { where?: { id?: string } }) => {
        if (where?.id === 'run-2') {
          return Promise.resolve({
            id: 'run-2',
            importedCount: 10,
            finishedAt,
            status: 'SUCCEEDED',
          });
        }
        return Promise.resolve({
          id: 'run-2',
          importedCount: 10,
          finishedAt,
        });
      },
    );

    const status = await service.resolveStatus(organizationId);

    expect(status.lifecyclePhase).toBe('ASSESSMENT_CURRENT');
    expect(status.canRunAssessment).toBe(false);
    expect(status.findingsSnapshotRef).toBe('DISC-00002');
  });
});

describe('workforce-discovery-snapshot.util', () => {
  it('formats snapshot refs in sequence order', () => {
    expect(formatDiscoverySnapshotRef(15)).toBe('DISC-00015');
    expect(
      discoverySnapshotSequenceFromRuns(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        'b',
      ),
    ).toBe(2);
  });
});
