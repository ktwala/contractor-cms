import { useState, useEffect, useCallback } from 'react';
import { fetchOverviewStats, triggerStatsRefresh } from '../api';

export function useOverviewStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOverviewStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await triggerStatsRefresh();
      const data = await fetchOverviewStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, loading, error, refresh };
}
