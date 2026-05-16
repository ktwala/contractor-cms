'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import AddContractorModal from '@/components/supplier-portal/AddContractorModal';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { getSupplierPortalErrorMessage } from '@/lib/supplier-portal-errors';
import {
  SUPPLIER_PORTAL_CONTRACTOR_READ,
  canCreateSupplierPortalContractor,
} from '@/lib/supplier-portal-permissions';
import { useAuth } from '@/lib/auth-context';
import { Plus, Users } from 'lucide-react';

interface SupplierContractor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  workerClassification?: string;
  engagementModel?: string;
}

export default function SupplierPortalContractorsPage() {
  const { can } = useAuth();
  const canCreate = canCreateSupplierPortalContractor(can);
  const [contractors, setContractors] = useState<SupplierContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadContractors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await supplierPortalApi.getContractors({ page: 1, limit: 100 });
      setContractors(res.data || []);
    } catch (err) {
      setError(
        getSupplierPortalErrorMessage(err, 'Failed to load your supplier contractors.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  return (
    <RequirePermission permission={SUPPLIER_PORTAL_CONTRACTOR_READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title="Contractors"
            description="Your supplier contractors only — not the client-wide contractor registry."
            action={
              canCreate ? (
                <button
                  type="button"
                  className="btn btn-primary inline-flex items-center gap-2"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add contractor
                </button>
              ) : null
            }
          />

          {loading && <p className="text-sm text-gray-500">Loading contractors…</p>}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {!loading && !error && contractors.length === 0 && (
            <PortalEmptyState
              icon={Users}
              title="No contractors yet"
              description="Add contractors who work under your supplier. They are visible within your supplier scope and in the client registry for your organization."
              action={
                canCreate ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalOpen(true)}
                  >
                    Add your first contractor
                  </button>
                ) : undefined
              }
            />
          )}

          {!loading && contractors.length > 0 && (
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
                  {contractors.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.workerClassification?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.engagementModel || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCreate && (
            <AddContractorModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              onCreated={loadContractors}
            />
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
