import { Injectable } from '@nestjs/common';

export interface ReadinessInput {
  authoringUpdatedAt: Date;
  latestRunAt?: Date | null;
  latestRunId?: string | null;
  latestReviewStatus?: string | null;
  latestReviewAt?: Date | null;
  requireImpactAnalysis: boolean;
  requireAcceptedReview: boolean;
  maxAgeHours?: number | null;
}

export interface ReadinessResult {
  allowed: boolean;
  stale: boolean;
  reason: string | null;
  latestRunId: string | null;
  latestReviewStatus: string | null;
}

@Injectable()
export class TaxTableImpactAnalysisReadinessService {
  evaluate(input: ReadinessInput): ReadinessResult {
    const {
      authoringUpdatedAt,
      latestRunAt,
      latestRunId,
      latestReviewStatus,
      latestReviewAt,
      requireImpactAnalysis,
      requireAcceptedReview,
      maxAgeHours,
    } = input;

    if (!latestRunAt) {
      return {
        allowed: !requireImpactAnalysis && !requireAcceptedReview,
        stale: false,
        reason: requireImpactAnalysis ? 'TTA_IMPACT_PUBLISH_REQUIRES_RUN' : null,
        latestRunId: latestRunId ?? null,
        latestReviewStatus: latestReviewStatus ?? null,
      };
    }

    const staleByDraftChange = authoringUpdatedAt.getTime() > latestRunAt.getTime();

    const staleByAge =
      maxAgeHours != null
        ? Date.now() - latestRunAt.getTime() > maxAgeHours * 60 * 60 * 1000
        : false;

    const stale = staleByDraftChange || staleByAge;

    if (requireImpactAnalysis && stale) {
      return {
        allowed: false,
        stale: true,
        reason: 'TTA_IMPACT_PUBLISH_RUN_STALE',
        latestRunId: latestRunId ?? null,
        latestReviewStatus: latestReviewStatus ?? null,
      };
    }

    if (requireAcceptedReview) {
      const reviewMissing = latestReviewStatus !== 'ACCEPTED';
      const reviewTooOld =
        latestReviewAt != null
          ? latestReviewAt.getTime() < latestRunAt.getTime()
          : true;

      if (reviewMissing || reviewTooOld) {
        return {
          allowed: false,
          stale,
          reason: 'TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW',
          latestRunId: latestRunId ?? null,
          latestReviewStatus: latestReviewStatus ?? null,
        };
      }
    }

    return {
      allowed: true,
      stale,
      reason: null,
      latestRunId: latestRunId ?? null,
      latestReviewStatus: latestReviewStatus ?? null,
    };
  }
}
