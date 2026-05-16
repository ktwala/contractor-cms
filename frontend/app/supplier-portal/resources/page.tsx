'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';

interface Resource {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  workerClassification?: string;
}

export default function SupplierPortalResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supplierPortalApi
      .getResources({ page: 1, limit: 100 })
      .then((res) => setResources(res.data || []))
      .catch(() => setError('Failed to load resources'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_RESOURCES.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Resources</h1>
            <p className="text-sm text-gray-500 mt-1">
              Contractors nominated under your supplier (no client-wide registry).
            </p>
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && resources.length === 0 && (
            <p className="text-gray-500">No resources yet.</p>
          )}
          <div className="grid gap-3">
            {resources.map((r) => (
              <div key={r.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{r.email}</p>
                </div>
                <span className="text-xs text-gray-400">{r.workerClassification}</span>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
