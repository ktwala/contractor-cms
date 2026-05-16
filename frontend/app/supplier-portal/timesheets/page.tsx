'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import StatusBadge from '@/components/ui/status-badge';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { format } from 'date-fns';

interface PortalTimesheet {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  status: string;
  contractor?: { firstName: string; lastName: string; email: string };
}

export default function SupplierPortalTimesheetsPage() {
  const [timesheets, setTimesheets] = useState<PortalTimesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supplierPortalApi
      .getTimesheets({ page: 1, limit: 100 })
      .then((res) => setTimesheets(res.data || []))
      .catch(() => setError('Failed to load timesheets'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_TIMESHEETS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Timesheets</h1>
            <p className="text-sm text-gray-500 mt-1">
              Submissions for your supplier&apos;s resources only.
            </p>
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && timesheets.length === 0 && (
            <p className="text-gray-500">No timesheets yet.</p>
          )}
          <div className="space-y-3">
            {timesheets.map((ts) => (
              <div key={ts.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {ts.contractor
                        ? `${ts.contractor.firstName} ${ts.contractor.lastName}`
                        : 'Resource'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(ts.periodStart), 'dd MMM yyyy')} –{' '}
                      {format(new Date(ts.periodEnd), 'dd MMM yyyy')} · {ts.totalHours}h
                    </p>
                  </div>
                  <StatusBadge status={ts.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
