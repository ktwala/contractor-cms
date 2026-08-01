'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import AddContractorModal from '@/components/supplier-portal/AddContractorModal';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import {
  getSupplierPortalErrorMessage,
  isSupplierPortalLoadFailure,
} from '@/lib/supplier-portal-errors';
import { SUPPLIER_NOT_LINKED_TITLE } from '@/lib/supplier-portal-context';
import {
  SUPPLIER_PORTAL_EMPTY_COPY,
  SUPPLIER_PORTAL_EMPTY_STATES,
  unwrapSupplierPortalList,
} from '@/lib/supplier-portal-response';
import {
  SUPPLIER_PORTAL_CONTRACTOR_READ,
  canCreateSupplierPortalContractor,
} from '@/lib/supplier-portal-permissions';
import { useAuth } from '@/lib/auth-context';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import Link from 'next/link';
import { safeReplace, safeString } from '@/lib/safe-string';
import { formatWorkforceState, workforceStateBadgeClass } from '@/lib/workforce-state';
import { Plus, Users } from 'lucide-react';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

interface SupplierContractor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  workerClassification?: string;
  engagementModel?: string;
  workforceState?: string;
}

export default function SupplierPortalContractorsPage() {
  const { can } = useAuth();
  const { ready, supplierLinked, blockedMessage, guardApiCall } = useSupplierPortalGate();
  const canCreate = canCreateSupplierPortalContractor(can);
  const [contractors, setContractors] = useState<SupplierContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadContractors = useCallback(async () => {
    if (!guardApiCall(true)) {
      setLoading(false);
      setContractors([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await supplierPortalApi.getContractors({ page: 1, limit: 100 });
      const { items } = unwrapSupplierPortalList<SupplierContractor>(res);
      setContractors(items);
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(
            err,
            'The server could not load your external workers.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [guardApiCall]);

  useEffect(() => {
    if (ready) loadContractors();
  }, [ready, loadContractors]);

  return (
    <RequirePermission permission={SUPPLIER_PORTAL_CONTRACTOR_READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title={EXTERNAL_WORKFORCE_LABELS.workers}
            description="Your external workers only — not the client-wide external workforce registry."
            action={
              canCreate && supplierLinked ? (
                <button
                  type="button"
                  className="btn btn-primary inline-flex items-center gap-2"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nominate external worker
                </button>
              ) : null
            }
          />

          {!supplierLinked && ready && (
            <PortalEmptyState
              icon={Users}
              title={SUPPLIER_NOT_LINKED_TITLE}
              description={blockedMessage ?? 'No supplier membership is active for your account.'}
            />
          )}

          {supplierLinked && loading && (
            <p className="text-sm text-gray-500">Loading contractors…</p>
          )}
          {supplierLinked && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {supplierLinked && !loading && !error && contractors.length === 0 && (
            <PortalEmptyState
              icon={Users}
              title={SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_CONTRACTORS].title}
              description={
                SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_CONTRACTORS]
                  .description
              }
              action={
                canCreate ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalOpen(true)}
                  >
                    Add your first nomination
                  </button>
                ) : undefined
              }
            />
          )}

          {supplierLinked && !loading && contractors.length > 0 && (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Workforce state
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {contractors.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link
                          href={`/supplier-portal/contractors/${c.id}`}
                          className="text-primary-700 hover:underline"
                        >
                          {safeString(c.firstName)} {safeString(c.lastName)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {safeReplace(c.workerClassification, /_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.engagementModel || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workforceStateBadgeClass(c.workforceState)}`}
                        >
                          {formatWorkforceState(c.workforceState)}
                        </span>
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
