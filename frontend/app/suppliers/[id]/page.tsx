'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { api } from '@/lib/api';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import SupplierEvidenceChecklist from '@/components/suppliers/SupplierEvidenceChecklist';
import { SupplierOperationalTrustPanel } from '@/components/suppliers/SupplierOperationalTrustPanel';
import SupplierDocumentsPanel from '@/components/suppliers/SupplierDocumentsPanel';
import { EvidenceChecklistResult } from '@/lib/supplier-evidence';
import { ArrowLeft, Edit } from 'lucide-react';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
import { useAuth } from '@/lib/auth-context';
import {
  OPERATIONAL_TRUST_LABELS,
  oracleProcurementLabel,
  operationalTrustBadgeClass,
  operationalTrustLabel,
} from '@/lib/operational-trust-labels';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supplierId = String(params?.id ?? '');
  const { can } = useAuth();

  const [supplier, setSupplier] = useState<Record<string, unknown> | null>(null);
  const [checklist, setChecklist] = useState<EvidenceChecklistResult | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadChecklist = useCallback(async () => {
    setChecklistLoading(true);
    try {
      const data = await api.getSupplierEvidenceChecklist(supplierId);
      setChecklist(data);
    } catch {
      setChecklist(null);
    } finally {
      setChecklistLoading(false);
    }
  }, [supplierId]);

  const loadSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSupplier(supplierId);
      setSupplier(data);
    } catch {
      setSupplier(null);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (!supplierId) return;
    void loadSupplier();
    void loadChecklist();
  }, [supplierId, loadSupplier, loadChecklist]);

  useOperationalTrustChanged((detail) => {
    if (detail.supplierId !== supplierId) return;
    setSupplier((prev) => (prev ? { ...prev, status: detail.currentState } : prev));
    void loadSupplier();
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-gray-600">Supplier not found.</p>
          <button type="button" onClick={() => router.push('/suppliers')} className="btn btn-secondary mt-4">
            Back to suppliers
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const name = formatSupplierDisplayName(supplier as Parameters<typeof formatSupplierDisplayName>[0]);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIERS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/suppliers')}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-sm text-gray-500">{String(supplier.email)}</p>
                  {supplier.externalSupplierId ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {OPERATIONAL_TRUST_LABELS.oracleColumn}:{' '}
                      {oracleProcurementLabel(String(supplier.externalSupplierId))}
                    </span>
                  ) : null}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${operationalTrustBadgeClass(String(supplier.status ?? ''))}`}
                  >
                    {operationalTrustLabel(String(supplier.status ?? ''))}
                  </span>
                </div>
              </div>
            </div>
            {can(PERMISSIONS.SUPPLIERS.UPDATE) && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit profile
              </button>
            )}
          </div>

          <SupplierOperationalTrustPanel
            supplierId={supplierId}
            supplierStatus={String(supplier.status ?? '')}
          />

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">EWP readiness evidence</h2>
            <SupplierEvidenceChecklist checklist={checklist} loading={checklistLoading} />
          </section>

          <section>
            <SupplierDocumentsPanel
              supplierId={supplierId}
              country={String(supplier.country ?? '')}
              countryCode={String(supplier.countryCode ?? supplier.country ?? '')}
              onChanged={() => {
                void loadChecklist();
              }}
            />
          </section>
        </div>

        <SupplierFormModal
          isOpen={showEditModal}
          supplierId={supplierId}
          onClose={() => setShowEditModal(false)}
          onSaved={(saved) => {
            setSupplier(saved);
            void loadChecklist();
          }}
        />
      </DashboardLayout>
    </RequirePermission>
  );
}
