import { useState, useEffect, useCallback } from 'react';
import { fetchLegalEntityStats } from '../api';

export function useLegalEntityStats(filters?: Record<string, string>) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLegalEntityStats(filters);
      setStats(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  return { stats, loading, error, reload: load };
}
