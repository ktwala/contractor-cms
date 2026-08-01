import { useState, useCallback } from 'react';
import { runImpactAnalysis } from '../api';

export type ImpactAnalysisData = {
  summary: {
    employeesAnalyzed: number;
    employeesAffected: number;
    employeesUnchanged: number;
    employeesSkipped: number;
    totalBaselinePaye: number;
    totalDraftPaye: number;
    totalPayeDelta: number;
    averageDeltaAll: number;
    averageDeltaAffected: number;
    biggestIncrease: { employeeId: string; amount: number } | null;
    biggestDecrease: { employeeId: string; amount: number } | null;
    buckets: Array<{ label: string; count: number }>;
    warnings: string[];
  };
  rows: Array<{
    employeeId: string;
    employeeNumber: string | null;
    employeeName: string | null;
    legalEntityName: string | null;
    payGroupName: string | null;
    taxableEarnings: number;
    baselinePaye: number;
    draftPaye: number;
    deltaPaye: number;
    absoluteDelta: number;
    direction: 'INCREASE' | 'DECREASE' | 'UNCHANGED';
    baselineBracketLabel: string | null;
    draftBracketLabel: string | null;
  }>;
};

export function useImpactAnalysis() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImpactAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (payload: Parameters<typeof runImpactAnalysis>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await runImpactAnalysis(payload);
      setData(result);
      return result;
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e.message ?? 'Impact analysis failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { loading, data, error, execute, clear };
}
