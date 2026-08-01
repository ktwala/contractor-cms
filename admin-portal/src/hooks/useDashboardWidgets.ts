import { useState, useEffect } from 'react';
import api from '../services/api';

export interface WorkforceSummary {
  employees: number;
  employments: number;
  org_units: number;
  cost_centers: number;
  legal_entities: number;
  positions: number;
}

export interface PayrollSnapshotData {
  current_period: { label: string; status: string } | null;
  pending_approvals: number;
  exceptions: number;
  payment_batches: number;
  next_pay_date: string | null;
  setup_required?: boolean;
}

export interface ComplianceSummary {
  emp201?: { status: string; due_date?: string };
  irp5?: { status: string };
  alerts: number;
  tax_tables_configured: boolean;
}

export interface DataImportsSummary {
  latest_job: { id: string; name: string; status: string; submitted_at: string } | null;
  rejected_rows: number;
  pending_jobs: number;
}

export interface HrExportReadiness {
  status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  exportable_employees: number;
  warnings: number;
  last_validated_at?: string;
  issues?: { code: string; count: number }[];
}

export interface PendingApprovalsData {
  total_pending: number;
  my_pending: number;
  items: { entity_type: string; entity_id: string; description: string; submitted_at: string; level: number }[];
}

export function useWorkforceSummary(enabled: boolean) {
  const [data, setData] = useState<WorkforceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<WorkforceSummary>('/dashboard/workforce-summary').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}

export function usePayrollSnapshot(enabled: boolean) {
  const [data, setData] = useState<PayrollSnapshotData | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<PayrollSnapshotData>('/dashboard/payroll-summary').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}

export function useComplianceSummary(enabled: boolean) {
  const [data, setData] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<ComplianceSummary>('/dashboard/compliance-summary').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}

export function useDataImportsSummary(enabled: boolean) {
  const [data, setData] = useState<DataImportsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<DataImportsSummary>('/dashboard/data-imports-summary').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}

export function useHrExportReadiness(enabled: boolean) {
  const [data, setData] = useState<HrExportReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<HrExportReadiness>('/dashboard/hr-export-readiness').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}

export function usePendingApprovals(enabled: boolean) {
  const [data, setData] = useState<PendingApprovalsData | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api.get<PendingApprovalsData>('/dashboard/pending-approvals').then(
      (r) => { if (!cancelled) setData(r.data); },
      () => {},
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, loading };
}
