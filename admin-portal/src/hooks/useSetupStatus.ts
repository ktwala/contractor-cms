import { useState, useEffect } from 'react';
import api from '../services/api';

export interface SetupItem {
  key: string;
  label: string;
  ready: boolean;
  count: number;
  href?: string;
  optional?: boolean;
}

export interface SetupStatus {
  complete: boolean;
  items: SetupItem[];
  legal_entities: number;
  org_units: number;
  cost_centers: number;
  company_groups: number;
  positions: number;
  employees: number;
  employments: number;
}

export function useSetupStatus() {
  const [data, setData] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<SetupStatus>('/setup/status')
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
