import { useEffect, useState, useCallback } from 'react';
import { listImpactAnalysisRuns, getImpactAnalysisLatestReview } from '../api';

export type ImpactAnalysisRunItem = {
  id: string;
  authoringVersionId: string;
  countryCode: string;
  basisMode: string;
  payGroupId?: string | null;
  payrunId?: string | null;
  employeesAnalyzed: number;
  employeesAffected: number;
  employeesSkipped: number;
  totalPayeDelta: number;
  averageDeltaAffected: number;
  runAt: string;
  reviews?: Array<{
    reviewStatus: string;
    reviewComment?: string | null;
    reviewedAt: string;
  }>;
};

export type LatestReviewInfo = {
  latestRunId?: string | null;
  latestRunAt?: string | null;
  latestReviewStatus?: string | null;
  latestReviewComment?: string | null;
  latestReviewedAt?: string | null;
  allowed: boolean;
  stale: boolean;
  reason?: string | null;
};

export function useImpactAnalysisRuns(authoringVersionId: string) {
  const [runs, setRuns] = useState<ImpactAnalysisRunItem[]>([]);
  const [latest, setLatest] = useState<LatestReviewInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!authoringVersionId) return;
    setLoading(true);
    try {
      const [runsData, latestData] = await Promise.all([
        listImpactAnalysisRuns(authoringVersionId),
        getImpactAnalysisLatestReview(authoringVersionId),
      ]);
      setRuns(runsData);
      setLatest(latestData);
    } catch {
      // silently fail; caller can re-trigger
    } finally {
      setLoading(false);
    }
  }, [authoringVersionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, latest, loading, refresh };
}
