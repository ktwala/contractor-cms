import { useState, useEffect, useCallback } from 'react';
import { fetchWorkforceIssues } from '../api';

export function useWorkforceIssues(filters?: Record<string, string>) {
  const [issues, setIssues] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWorkforceIssues(filters);
      setIssues(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  return { issues, loading, error, reload: load };
}
