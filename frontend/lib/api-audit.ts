/**
 * Audit Log API wrapper
 *
 * Read-only API for the audit log UI.
 * All endpoints require audit:read permission.
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditLog = {
  id: string;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  result: 'success' | 'failed';
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type AuditLogListParams = {
  from?: string;
  to?: string;
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  result?: 'success' | 'failed';
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function cleanParams(params: AuditLogListParams): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      clean[key] = String(value);
    }
  }
  return clean;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * List audit logs with pagination and filters.
 */
export async function listAuditLogs(
  params: AuditLogListParams = {},
): Promise<PaginatedResponse<AuditLog>> {
  const response = await axios.get(`${API_BASE_URL}/audit-logs`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    params: cleanParams(params),
  });
  return response.data;
}

/**
 * Get a single audit log entry by ID.
 */
export async function getAuditLog(id: string): Promise<AuditLog> {
  const response = await axios.get(`${API_BASE_URL}/audit-logs/${id}`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  });
  return response.data;
}

/**
 * Get aggregated audit insights for the dashboard.
 */
export async function getAuditInsights(startDate: string, endDate: string): Promise<any> {
  const response = await axios.get(`${API_BASE_URL}/settings/audit-insights`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    params: { startDate, endDate },
  });
  return response.data;
}

/**
 * Export audit logs as CSV using current filters.
 * Triggers a file download in the browser.
 * Server enforces: max 31-day window, max 10k rows.
 */
export async function exportAuditLogs(
  params: AuditLogListParams = {},
): Promise<void> {
  const response = await axios.get(`${API_BASE_URL}/audit-logs/export`, {
    headers: getAuthHeaders(),
    params: cleanParams(params),
    responseType: 'blob',
  });

  // Trigger browser download
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const auditApi = {
  listAuditLogs,
  getAuditLog,
  exportAuditLogs,
  getAuditInsights,
};
