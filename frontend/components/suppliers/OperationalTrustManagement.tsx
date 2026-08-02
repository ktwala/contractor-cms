'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Modal from '@/components/ui/modal';
import FormTextarea from '@/components/ui/form-textarea';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import {
  OPERATIONAL_TRUST_LABELS,
  OPERATIONAL_TRUST_NARRATIVE,
  OPERATIONAL_TRUST_ROUTES,
  formatLastOperationalTrustDecision,
  oracleProcurementLabel,
  operationalTrustBadgeClass,
  operationalTrustLabel,
  type OperationalTrustDecisionSummary,
} from '@/lib/operational-trust-labels';
import {
  buildOperationalTrustChangedDetail,
  dispatchOperationalTrustChanged,
  formatOperationalTrustChangedBy,
  useOperationalTrustChanged,
} from '@/lib/operational-trust-events';
import { CheckCircle, ExternalLink, RotateCcw, XCircle } from 'lucide-react';

type ManagedSupplier = {
  id: string;
  status: string;
  email?: string;
  companyName?: string;
  tradingName?: string;
  firstName?: string;
  lastName?: string;
  externalSupplierId?: string | null;
};

function pickLatestDecision(evidence: {
  latestGrant?: OperationalTrustDecisionSummary | null;
  latestSuspension?: OperationalTrustDecisionSummary | null;
}): OperationalTrustDecisionSummary | null {
  const candidates = [evidence.latestGrant, evidence.latestSuspension].filter(
    (event): event is OperationalTrustDecisionSummary => Boolean(event?.occurredAt),
  );
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )[0];
}

type StatusTab = 'ACTIVE' | 'SUSPENDED';

export default function OperationalTrustManagement() {
  const searchParams = useSearchParams();
  const statusParam = searchParams?.get('status');
  const initialTab: StatusTab =
    statusParam === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';

  const { showToast } = useToast();
  const { can, user } = useAuth();
  const canGrant = can(PERMISSIONS.SUPPLIERS.APPROVE);
  const canSuspend = can(PERMISSIONS.SUPPLIERS.SUSPEND);

  const [tab, setTab] = useState<StatusTab>(initialTab);
  const [suppliers, setSuppliers] = useState<ManagedSupplier[]>([]);
  const [lastDecisions, setLastDecisions] = useState<
    Record<string, OperationalTrustDecisionSummary | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [suspendTarget, setSuspendTarget] = useState<ManagedSupplier | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ManagedSupplier | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadLastDecisions = useCallback(async (rows: ManagedSupplier[]) => {
    if (rows.length === 0) {
      setLastDecisions({});
      return;
    }
    const entries = await Promise.all(
      rows.map(async (supplier) => {
        try {
          const evidence = await api.getSupplierOperationalTrustEvidence(supplier.id);
          return [supplier.id, pickLatestDecision(evidence)] as const;
        } catch {
          return [supplier.id, null] as const;
        }
      }),
    );
    setLastDecisions(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliers({
        page: 1,
        limit: 100,
        governanceBucket: tab === 'ACTIVE' ? 'active' : 'suspended',
      });
      const rows = (res.data ?? []) as ManagedSupplier[];
      setSuppliers(rows);
      await loadLastDecisions(rows);
    } catch {
      showToast('error', 'Failed to load Operational Trust Management');
      setSuppliers([]);
      setLastDecisions({});
    } finally {
      setLoading(false);
    }
  }, [loadLastDecisions, showToast, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useOperationalTrustChanged(() => {
    void load();
  });

  const emptyMessage = useMemo(
    () =>
      tab === 'ACTIVE'
        ? OPERATIONAL_TRUST_LABELS.managementEmptyGranted
        : OPERATIONAL_TRUST_LABELS.managementEmptySuspended,
    [tab],
  );

  const closeModals = () => {
    setSuspendTarget(null);
    setRestoreTarget(null);
    setReason('');
    setReasonError('');
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTarget) return;
    const note = reason.trim();
    if (!note) {
      setReasonError('Reviewer note is required');
      return;
    }
    setProcessingId(suspendTarget.id);
    setReasonError('');
    try {
      await api.transitionSupplierStatus(suspendTarget.id, {
        targetStatus: 'SUSPENDED',
        reason: note,
      });
      showToast('success', 'Operational Trust suspended');
      closeModals();
      setTab('SUSPENDED');
      dispatchOperationalTrustChanged(
        buildOperationalTrustChangedDetail({
          supplierId: suspendTarget.id,
          previousState: suspendTarget.status,
          currentState: 'SUSPENDED',
          reason: note,
          changedBy: formatOperationalTrustChangedBy(user),
        }),
      );
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not suspend Operational Trust';
      setReasonError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget) return;
    const note = reason.trim();
    if (!note) {
      setReasonError('Reviewer note is required');
      return;
    }
    setProcessingId(restoreTarget.id);
    setReasonError('');
    try {
      await api.transitionSupplierStatus(restoreTarget.id, {
        targetStatus: 'ACTIVE',
        reason: note,
      });
      showToast('success', 'Operational Trust restored');
      closeModals();
      setTab('ACTIVE');
      dispatchOperationalTrustChanged(
        buildOperationalTrustChangedDetail({
          supplierId: restoreTarget.id,
          previousState: restoreTarget.status,
          currentState: 'ACTIVE',
          reason: note,
          changedBy: formatOperationalTrustChangedBy(user),
        }),
      );
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not restore Operational Trust';
      setReasonError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="operational-trust-management">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {OPERATIONAL_TRUST_LABELS.managementPageTitle}
        </h1>
        <p className="text-gray-600 mt-1">{OPERATIONAL_TRUST_LABELS.managementIntro}</p>
        <p className="text-sm text-gray-500 mt-2">{OPERATIONAL_TRUST_NARRATIVE.queueVsManagement}</p>
        <Link
          href={OPERATIONAL_TRUST_ROUTES.queue}
          className="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
        >
          {OPERATIONAL_TRUST_LABELS.openQueue}
        </Link>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(
          [
            { id: 'ACTIVE' as const, label: OPERATIONAL_TRUST_LABELS.granted },
            { id: 'SUSPENDED' as const, label: OPERATIONAL_TRUST_LABELS.suspended },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === item.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
            data-testid={`operational-trust-tab-${item.id.toLowerCase()}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading Operational Trust Management…</p>
      ) : suppliers.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {OPERATIONAL_TRUST_LABELS.oracleColumn}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {OPERATIONAL_TRUST_LABELS.operationalTrustColumn}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {OPERATIONAL_TRUST_LABELS.lastDecisionColumn}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => {
                  const name = formatSupplierDisplayName(supplier);
                  const busy = processingId === supplier.id;
                  const lastDecision = lastDecisions[supplier.id];
                  const lastDecisionLabel = formatLastOperationalTrustDecision(lastDecision);
                  return (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{name}</div>
                        <div className="text-sm text-gray-500">{supplier.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {oracleProcurementLabel(supplier.externalSupplierId)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${operationalTrustBadgeClass(supplier.status)}`}
                        >
                          {operationalTrustLabel(supplier.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{lastDecisionLabel}</div>
                        {lastDecision?.actorDisplayName ? (
                          <div className="text-xs text-gray-500 mt-0.5">
                            by {lastDecision.actorDisplayName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium space-x-2 whitespace-nowrap">
                        <Link
                          href={OPERATIONAL_TRUST_ROUTES.supplier(supplier.id)}
                          className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                        >
                          History
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {tab === 'ACTIVE' && canSuspend ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSuspendTarget(supplier);
                              setRestoreTarget(null);
                              setReason('');
                              setReasonError('');
                            }}
                            className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            {OPERATIONAL_TRUST_LABELS.suspendAction}
                          </button>
                        ) : null}
                        {tab === 'SUSPENDED' && canGrant ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setRestoreTarget(supplier);
                              setSuspendTarget(null);
                              setReason('');
                              setReasonError('');
                            }}
                            className="btn btn-primary btn-sm inline-flex items-center gap-1"
                            data-testid={`restore-operational-trust-${supplier.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            {OPERATIONAL_TRUST_LABELS.restoreAction}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={Boolean(suspendTarget)} onClose={closeModals} title="Suspend Operational Trust" size="md">
        {suspendTarget ? (
          <form onSubmit={handleSuspend} className="space-y-4">
            <p className="text-sm text-gray-600">
              Suspending Operational Trust for{' '}
              <strong>{formatSupplierDisplayName(suspendTarget)}</strong> stops EWP participation.
              Linked workers cannot be operationalized until trust is restored. A reviewer note is
              required for audit.
            </p>
            <FormTextarea
              label="Reviewer note"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reasonError}
              required
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={closeModals}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === suspendTarget.id}
                className="btn btn-primary"
              >
                {processingId === suspendTarget.id ? 'Suspending…' : 'Confirm suspend'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal isOpen={Boolean(restoreTarget)} onClose={closeModals} title="Restore Operational Trust" size="md">
        {restoreTarget ? (
          <form onSubmit={handleRestore} className="space-y-4">
            <p className="text-sm text-gray-600">
              Restoring Operational Trust for{' '}
              <strong>{formatSupplierDisplayName(restoreTarget)}</strong> enables EWP participation
              again. Linked workers may then be operationalized. A reviewer note is required for
              audit.
            </p>
            <FormTextarea
              label="Reviewer note"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reasonError}
              required
              rows={4}
              placeholder="Supplier enabled for External Workforce participation after governance review."
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={closeModals}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === restoreTarget.id}
                className="btn btn-primary inline-flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                {processingId === restoreTarget.id ? 'Restoring…' : 'Confirm restore'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
