'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import ResourceNominationModal from '@/components/supplier-portal/ResourceNominationModal';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { useAuth } from '@/lib/auth-context';
import { Plus, Users } from 'lucide-react';

interface Resource {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  workerClassification?: string;
  engagementModel?: string;
}

export default function SupplierPortalResourcesPage() {
  const { can } = useAuth();
  const canCreate = can(PERMISSIONS.SUPPLIER_RESOURCES.CREATE);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await supplierPortalApi.getResources({ page: 1, limit: 100 });
      setResources(res.data || []);
    } catch {
      setError('Failed to load your nominated resources.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_RESOURCES.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title="Resources"
            description="Contractors nominated under your supplier only — not the client workforce registry."
            action={
              canCreate ? (
                <button
                  type="button"
                  className="btn btn-primary inline-flex items-center gap-2"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nominate resource
                </button>
              ) : null
            }
          />

          {loading && <p className="text-sm text-gray-500">Loading resources…</p>}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {!loading && !error && resources.length === 0 && (
            <PortalEmptyState
              icon={Users}
              title="No resources yet"
              description="Nominate contractors who work under your supplier. They will only be visible within your supplier scope."
              action={
                canCreate ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalOpen(true)}
                  >
                    Nominate your first resource
                  </button>
                ) : undefined
              }
            />
          )}

          {!loading && resources.length > 0 && (
            <div className="overflow-hidden card p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Classification
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Engagement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {resources.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.workerClassification?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.engagementModel || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCreate && (
            <ResourceNominationModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              onCreated={loadResources}
            />
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
