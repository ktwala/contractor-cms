'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import RequirePermission from '@/components/RequirePermission';
import AuditDetailDrawer from '@/components/ui/audit-detail-drawer';
import DateRangeFilter from '@/components/ui/date-range-filter';
import { PERMISSIONS } from '@/lib/permissions.generated';
import {
  listAuditLogs,
  exportAuditLogs,
  AuditLog,
  AuditLogListParams,
  PaginatedResponse,
} from '@/lib/api-audit';
import { useDebounce } from '@/lib/hooks';

// ---------------------------------------------------------------------------
// Known audit actions for the dropdown filter
// ---------------------------------------------------------------------------
const KNOWN_ACTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_ROLE_ASSIGNED',
  'USER_ROLE_REMOVED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
];

const KNOWN_TARGET_TYPES = ['User', 'Role', 'UserRole', 'Organization'];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Filter state — initialized from URL
  // ---------------------------------------------------------------------------
  const [filters, setFilters] = useState<AuditLogListParams>(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      from: searchParams.get('from') || yesterday.toISOString().slice(0, 10),
      to: searchParams.get('to') || now.toISOString().slice(0, 10),
      actorUserId: searchParams.get('actorUserId') || '',
      action: searchParams.get('action') || '',
      targetType: searchParams.get('targetType') || '',
      targetId: searchParams.get('targetId') || '',
      result: (searchParams.get('result') as 'success' | 'failed') || undefined,
      search: searchParams.get('search') || '',
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 50,
    };
  });

  const [searchText, setSearchText] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchText, 400);

  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // ---------------------------------------------------------------------------
  // Sync debounced search into filters
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  // ---------------------------------------------------------------------------
  // Persist filters in URL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    router.replace(`/settings/audit-logs?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAuditLogs(filters);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAuditLogs(filters);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Export failed. Max date range is 31 days.');
    } finally {
      setExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------
  const updateFilter = (key: keyof AuditLogListParams, value: any) => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setFilters({
      from: yesterday.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      page: 1,
      pageSize: 50,
    });
    setSearchText('');
  };

  const totalPages = data ? Math.ceil(data.total / (data.pageSize || 50)) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <RequirePermission permission={PERMISSIONS.AUDIT.READ}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Audit Logs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Review security and RBAC activity. Read-only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4 mr-1.5" />
              Filters
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              id="export-csv-btn"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date range */}
              <div className="sm:col-span-2">
                <DateRangeFilter
                  startDate={filters.from || ''}
                  endDate={filters.to || ''}
                  onStartDateChange={(v) => updateFilter('from', v)}
                  onEndDateChange={(v) => updateFilter('to', v)}
                />
              </div>

              {/* Action */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => updateFilter('action', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All actions</option>
                  {KNOWN_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Target Type
                </label>
                <select
                  value={filters.targetType || ''}
                  onChange={(e) => updateFilter('targetType', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All types</option>
                  {KNOWN_TARGET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target ID / email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Target ID / Email
                </label>
                <input
                  type="text"
                  value={filters.targetId || ''}
                  onChange={(e) => updateFilter('targetId', e.target.value)}
                  placeholder="ID or email..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Result */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
                <select
                  value={filters.result || ''}
                  onChange={(e) =>
                    updateFilter('result', e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search actor, target, action..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Clear */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {data
              ? `${data.total} event${data.total !== 1 ? 's' : ''} found`
              : 'Loading...'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Rows:</span>
            <select
              value={filters.pageSize || 50}
              onChange={(e) => updateFilter('pageSize', Number(e.target.value))}
              className="text-xs border border-gray-300 rounded px-1.5 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Target Type', 'Target', 'Result', 'IP / Source'].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading audit events...
                    </td>
                  </tr>
                )}
                {!loading && data?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No audit events found for the current filters.
                    </td>
                  </tr>
                )}
                {!loading &&
                  data?.data.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogId(log.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {log.actor?.email || log.actorUserId || (
                          <span className="text-gray-400 italic">SYSTEM</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {log.targetType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono text-xs">
                        {log.targetId || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.result === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.result === 'success' ? '✓' : '✗'} {log.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-500">
              Page {data.page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))
                }
                disabled={(filters.page || 1) <= 1}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </button>
              <button
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    page: Math.min(totalPages, (f.page || 1) + 1),
                  }))
                }
                disabled={(filters.page || 1) >= totalPages}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AuditDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </RequirePermission>
  );
}
