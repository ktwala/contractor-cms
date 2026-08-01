import type { RequisitionApiRow } from './requisitions.service';

export type RequisitionViewModel = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  salaryRangeLabel: string;
  status: string;
  statusLabel: string;
  applicationCount: number;
  updatedAtLabel: string;
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function salaryLabel(min?: string | null, max?: string | null): string {
  if (!min && !max) return '—';
  if (min && max) return `${min} – ${max}`;
  if (min) return `${min}+`;
  return `Up to ${max}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  on_hold: 'Approved',
  open: 'Posted',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export function toRequisitionViewModel(row: RequisitionApiRow): RequisitionViewModel {
  return {
    id: row.id,
    title: row.title,
    department: row.department?.trim() ? row.department : '—',
    location: (() => {
      const bits: string[] = [];
      if (row.location?.trim()) bits.push(row.location.trim());
      if (row.remote) bits.push('Remote-friendly');
      if (row.hybrid) bits.push('Hybrid');
      return bits.length ? bits.join(' · ') : '—';
    })(),
    employmentType: row.employment_type?.trim() ? row.employment_type : '—',
    salaryRangeLabel: salaryLabel(row.salary_min, row.salary_max),
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    applicationCount: row.application_count ?? 0,
    updatedAtLabel: formatDate(row.updated_at),
  };
}

export function canEditRequisitionStatus(status: string): boolean {
  return status === 'draft';
}

export function canApproveRequisitionStatus(status: string): boolean {
  return status === 'draft';
}

export function canPostRequisitionStatus(status: string): boolean {
  return status === 'on_hold';
}

export function canCloseRequisitionStatus(status: string): boolean {
  return status === 'open';
}
