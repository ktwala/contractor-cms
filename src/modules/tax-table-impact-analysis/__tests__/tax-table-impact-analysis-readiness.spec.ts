import { TaxTableImpactAnalysisReadinessService } from '../tax-table-impact-analysis-readiness.service';

describe('TaxTableImpactAnalysisReadinessService', () => {
  let service: TaxTableImpactAnalysisReadinessService;

  beforeEach(() => {
    service = new TaxTableImpactAnalysisReadinessService();
  });

  it('should allow when no run exists and impact analysis not required', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T10:00:00Z'),
      latestRunAt: null,
      latestRunId: null,
      latestReviewStatus: null,
      latestReviewAt: null,
      requireImpactAnalysis: false,
      requireAcceptedReview: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('should block when no run exists and impact analysis is required', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T10:00:00Z'),
      latestRunAt: null,
      latestRunId: null,
      latestReviewStatus: null,
      latestReviewAt: null,
      requireImpactAnalysis: true,
      requireAcceptedReview: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TTA_IMPACT_PUBLISH_REQUIRES_RUN');
  });

  it('should detect staleness when draft updated after run', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T12:00:00Z'),
      latestRunAt: new Date('2026-03-17T10:00:00Z'),
      latestRunId: 'run-1',
      latestReviewStatus: null,
      latestReviewAt: null,
      requireImpactAnalysis: true,
      requireAcceptedReview: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.stale).toBe(true);
    expect(result.reason).toBe('TTA_IMPACT_PUBLISH_RUN_STALE');
  });

  it('should detect staleness by age when maxAgeHours exceeded', () => {
    const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = service.evaluate({
      authoringUpdatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      latestRunAt: twoHoursAgo,
      latestRunId: 'run-1',
      latestReviewStatus: null,
      latestReviewAt: null,
      requireImpactAnalysis: true,
      requireAcceptedReview: false,
      maxAgeHours: 1,
    });
    expect(result.stale).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it('should allow fresh run when impact analysis required', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T09:00:00Z'),
      latestRunAt: new Date('2026-03-17T10:00:00Z'),
      latestRunId: 'run-1',
      latestReviewStatus: null,
      latestReviewAt: null,
      requireImpactAnalysis: true,
      requireAcceptedReview: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.stale).toBe(false);
  });

  it('should block when accepted review required but not present', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T09:00:00Z'),
      latestRunAt: new Date('2026-03-17T10:00:00Z'),
      latestRunId: 'run-1',
      latestReviewStatus: 'CONCERNS_RAISED',
      latestReviewAt: new Date('2026-03-17T10:30:00Z'),
      requireImpactAnalysis: false,
      requireAcceptedReview: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW');
  });

  it('should allow when accepted review exists and is fresh', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T09:00:00Z'),
      latestRunAt: new Date('2026-03-17T10:00:00Z'),
      latestRunId: 'run-1',
      latestReviewStatus: 'ACCEPTED',
      latestReviewAt: new Date('2026-03-17T10:30:00Z'),
      requireImpactAnalysis: false,
      requireAcceptedReview: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('should block when review is older than the run', () => {
    const result = service.evaluate({
      authoringUpdatedAt: new Date('2026-03-17T09:00:00Z'),
      latestRunAt: new Date('2026-03-17T10:00:00Z'),
      latestRunId: 'run-1',
      latestReviewStatus: 'ACCEPTED',
      latestReviewAt: new Date('2026-03-17T09:30:00Z'),
      requireImpactAnalysis: false,
      requireAcceptedReview: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW');
  });
});
