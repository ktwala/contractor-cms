import { useState, useEffect } from 'react';
import api from '../services/api';

export interface DashboardSummary {
  widgets: {
    setup_progress?: { visible: true; data: any } | { visible: false };
    workforce_snapshot?: { visible: true; data: any } | { visible: false };
    payroll_snapshot?: { visible: true; data: any } | { visible: false };
    compliance_snapshot?: { visible: true; data: any } | { visible: false };
    pending_approvals?: { visible: true; data: any } | { visible: false };
    data_imports?: { visible: true; data: any } | { visible: false };
    hr_export_readiness?: { visible: true; data: any } | { visible: false };
  };
  meta?: {
    generated_at: string;
    scope_mode: string;
    legal_entity_count: number;
  };
}

export function useDashboardSummary() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await api.get<DashboardSummary>('/dashboard/summary');
        if (!mounted) return;
        setData(res.data);
      } catch (err: any) {
        if (!mounted) return;
        const status = err?.response?.status;
        const msg = err?.response?.data?.message;
        if (status === 403) {
          setError(msg || 'You do not have permission to view the dashboard. Try logging out and back in.');
        } else if (status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError(msg || 'Failed to load dashboard');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}
