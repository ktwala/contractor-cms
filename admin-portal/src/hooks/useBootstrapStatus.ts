import React from 'react';
import api from '../services/api';

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 3;

export type BootstrapStatus = {
  loading: boolean;
  bootstrapRequired: boolean;
  userCount: number | null;
  connectionFailed: boolean;
  refetch: () => Promise<void>;
  retrying: boolean;
};

export function useBootstrapStatus(): BootstrapStatus {
  const [loading, setLoading] = React.useState(true);
  const [bootstrapRequired, setBootstrapRequired] = React.useState(false);
  const [userCount, setUserCount] = React.useState<number | null>(null);
  const [connectionFailed, setConnectionFailed] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    const res = await api.get('/bootstrap/status');
    setBootstrapRequired(!!res.data?.bootstrap_required);
    setUserCount(typeof res.data?.user_count === 'number' ? res.data.user_count : null);
  }, []);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setConnectionFailed(false);
    setRetrying(true);
    try {
      await fetchStatus();
    } catch {
      setConnectionFailed(true);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [fetchStatus]);

  React.useEffect(() => {
    let retryCount = 0;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const attemptLoad = async () => {
      try {
        const res = await api.get('/bootstrap/status');
        if (cancelled) return;
        setBootstrapRequired(!!res.data?.bootstrap_required);
        setUserCount(typeof res.data?.user_count === 'number' ? res.data.user_count : null);
        setConnectionFailed(false);
        setLoading(false);
      } catch {
        if (cancelled) return;
        if (retryCount < MAX_RETRIES) {
          retryCount += 1;
          timeoutId = setTimeout(attemptLoad, RETRY_DELAY_MS);
        } else {
          setConnectionFailed(true);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setConnectionFailed(false);
    attemptLoad();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return { loading, bootstrapRequired, userCount, connectionFailed, refetch, retrying };
}
