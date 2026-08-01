import { TaxTableImpactAnalysisReviewService } from '../tax-table-impact-analysis-review.service';

describe('TaxTableImpactAnalysisReviewService', () => {
  let service: TaxTableImpactAnalysisReviewService;
  let mockPrisma: any;
  let mockRunRepo: any;

  beforeEach(() => {
    mockPrisma = {
      taxTableAuthoringVersion: {
        findUnique: jest.fn(),
      },
    };
    mockRunRepo = {
      getRun: jest.fn(),
      createReview: jest.fn(),
    };
    service = new TaxTableImpactAnalysisReviewService(mockPrisma, mockRunRepo);
  });

  it('should throw when run not found', async () => {
    mockRunRepo.getRun.mockResolvedValue(null);
    await expect(
      service.review('missing', { reviewStatus: 'ACCEPTED' as any }, 'user-1'),
    ).rejects.toThrow('Impact analysis run not found');
  });

  it('should throw when authoring version not found', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-1',
      authoringVersionId: 'av-1',
      runAt: new Date('2026-03-17T10:00:00Z'),
    });
    mockPrisma.taxTableAuthoringVersion.findUnique.mockResolvedValue(null);

    await expect(
      service.review('run-1', { reviewStatus: 'ACCEPTED' as any }, 'user-1'),
    ).rejects.toThrow('Authoring version not found');
  });

  it('should block ACCEPTED review on stale run', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-1',
      authoringVersionId: 'av-1',
      runAt: new Date('2026-03-17T10:00:00Z'),
    });
    mockPrisma.taxTableAuthoringVersion.findUnique.mockResolvedValue({
      id: 'av-1',
      updatedAt: new Date('2026-03-17T12:00:00Z'),
    });

    await expect(
      service.review('run-1', { reviewStatus: 'ACCEPTED' as any }, 'user-1'),
    ).rejects.toThrow('stale');
  });

  it('should allow CONCERNS_RAISED on stale run', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-1',
      authoringVersionId: 'av-1',
      runAt: new Date('2026-03-17T10:00:00Z'),
    });
    mockPrisma.taxTableAuthoringVersion.findUnique.mockResolvedValue({
      id: 'av-1',
      updatedAt: new Date('2026-03-17T12:00:00Z'),
    });
    mockRunRepo.createReview.mockResolvedValue({ id: 'review-1' });

    const result = await service.review(
      'run-1',
      { reviewStatus: 'CONCERNS_RAISED' as any },
      'user-1',
    );
    expect(result).toEqual({ id: 'review-1' });
    expect(mockRunRepo.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: 'CONCERNS_RAISED',
        reviewedByUserId: 'user-1',
      }),
    );
  });

  it('should allow ACCEPTED review on fresh run', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-1',
      authoringVersionId: 'av-1',
      runAt: new Date('2026-03-17T12:00:00Z'),
    });
    mockPrisma.taxTableAuthoringVersion.findUnique.mockResolvedValue({
      id: 'av-1',
      updatedAt: new Date('2026-03-17T10:00:00Z'),
    });
    mockRunRepo.createReview.mockResolvedValue({ id: 'review-2' });

    const result = await service.review(
      'run-1',
      { reviewStatus: 'ACCEPTED' as any },
      'user-2',
    );
    expect(result).toEqual({ id: 'review-2' });
  });
});
