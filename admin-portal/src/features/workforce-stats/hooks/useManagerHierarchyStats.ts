import { useState, useEffect, useCallback } from 'react';
import { fetchManagerHierarchyStats } from '../api';

export function useManagerHierarchyStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchManagerHierarchyStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, loading, error, reload: load };
}
