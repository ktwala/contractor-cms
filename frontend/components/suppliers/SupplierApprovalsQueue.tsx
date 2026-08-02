'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Modal from '@/components/ui/modal';
import FormTextarea from '@/components/ui/form-textarea';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import SupplierEvidenceChecklist from '@/components/suppliers/SupplierEvidenceChecklist';
import {
  SupplierApprovalQueueItem,
  evidenceSummaryClass,
  evidenceSummaryLabel,
  parseSupplierTransitionError,
} from '@/lib/supplier-approvals';
import { EvidenceChecklistResult } from '@/lib/supplier-evidence';
import { OPERATIONAL_TRUST_LABELS, OPERATIONAL_TRUST_ROUTES } from '@/lib/operational-trust-labels';
import {
  buildOperationalTrustChangedDetail,
  dispatchOperationalTrustChanged,
  formatOperationalTrustChangedBy,
} from '@/lib/operational-trust-events';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function SupplierApprovalsQueue() {
  const searchParams = useSearchParams();
  const evidenceIncompleteOnly = searchParams?.get('evidenceIncomplete') === 'true';
  const { showToast } = useToast();
  const { can, user } = useAuth();
  const canGrant = can(PERMISSIONS.SUPPLIERS.APPROVE);
  const canSuspend = can(PERMISSIONS.SUPPLIERS.SUSPEND);

  const [items, setItems] = useState<SupplierApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [blockedChecklist, setBlockedChecklist] = useState<{
    supplierId: string;
    checklist: EvidenceChecklistResult;
  } | null>(null);

  const [rejectTarget, setRejectTarget] = useState<SupplierApprovalQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSupplierApprovalQueue(
        evidenceIncompleteOnly ? { evidenceIncomplete: true } : undefined,
      );
      setItems(res.data ?? []);
    } catch {
      showToast('error', 'Failed to load operational trust queue');
    } finally {
      setLoading(false);
    }
  }, [showToast, evidenceIncompleteOnly]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleGrantTrust = async (item: SupplierApprovalQueueItem) => {
    if (!item.canApprove) {
      showToast('error', 'You cannot grant operational trust for your own supplier record');
      return;
    }
    if (!item.evidenceComplete) {
      showToast('error', 'Complete all required EWP readiness checks before granting Operational Trust');
      return;
    }

    setProcessingId(item.id);
    setBlockedChecklist(null);
    try {
      await api.transitionSupplierStatus(item.id, {
        targetStatus: 'ACTIVE',
        reason: 'Operational Trust granted from operational trust queue',
      });
      showToast('success', 'Operational Trust granted');
      dispatchOperationalTrustChanged(
        buildOperationalTrustChangedDetail({
          supplierId: item.id,
          previousState: item.status,
          currentState: 'ACTIVE',
          reason: 'Operational Trust granted from operational trust queue',
          changedBy: formatOperationalTrustChangedBy(user),
        }),
      );
      await loadQueue();
    } catch (err: unknown) {
      const parsed = parseSupplierTransitionError(err);
      if (parsed.checklist) {
        setBlockedChecklist({ supplierId: item.id, checklist: parsed.checklist });
      }
      showToast('error', parsed.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;

    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError('Reviewer note is required');
      return;
    }

    setProcessingId(rejectTarget.id);
    setRejectError('');
    try {
      await api.transitionSupplierStatus(rejectTarget.id, {
        targetStatus: 'SUSPENDED',
        reason,
      });
      showToast('success', 'Supplier suspended — Operational Trust not granted');
      setRejectTarget(null);
      setRejectReason('');
      dispatchOperationalTrustChanged(
        buildOperationalTrustChangedDetail({
          supplierId: rejectTarget.id,
          previousState: rejectTarget.status,
          currentState: 'SUSPENDED',
          reason,
          changedBy: formatOperationalTrustChangedBy(user),
        }),
      );
      await loadQueue();
    } catch (err: unknown) {
      const parsed = parseSupplierTransitionError(err);
      setRejectError(parsed.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading operational trust queue…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{OPERATIONAL_TRUST_LABELS.pageTitle}</h1>
        <p className="text-gray-600 mt-1">
          {evidenceIncompleteOnly
            ? OPERATIONAL_TRUST_LABELS.queueIntroEvidenceBlocked
            : OPERATIONAL_TRUST_LABELS.queueIntro}
        </p>
        {evidenceIncompleteOnly && (
          <Link href="/suppliers/approvals" className="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block">
            Show all awaiting operational trust →
          </Link>
        )}
      </div>

      {blockedChecklist && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-3">
            Operational Trust blocked — required EWP readiness checks incomplete or expired
          </p>
          <SupplierEvidenceChecklist checklist={blockedChecklist.checklist} compact />
          <Link
            href={`/suppliers/${blockedChecklist.supplierId}`}
            className="inline-flex items-center gap-1 text-sm text-primary-600 mt-3 hover:underline"
          >
            Open supplier readiness checklist
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 space-y-3">
          <p>{OPERATIONAL_TRUST_LABELS.queueEmpty}</p>
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            {OPERATIONAL_TRUST_LABELS.queueEmptyFootnote}
          </p>
          <Link
            href={OPERATIONAL_TRUST_ROUTES.management}
            className="inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            {OPERATIONAL_TRUST_LABELS.openManagement}
          </Link>
        </div>
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
                    {OPERATIONAL_TRUST_LABELS.waitingForColumn}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    EWP readiness
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => {
                  const name = formatSupplierDisplayName(item);
                  const busy = processingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{name}</div>
                        <div className="text-sm text-gray-500">{item.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {OPERATIONAL_TRUST_LABELS.oracleApproved}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {OPERATIONAL_TRUST_LABELS.pending}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-sm">
                        {item.waitingFor}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${evidenceSummaryClass(item.evidenceStatus)}`}
                        >
                          {evidenceSummaryLabel(item.evidenceStatus)}
                        </span>
                        {item.evidenceNote ? (
                          <p className="text-xs text-gray-500 mt-1">{item.evidenceNote}</p>
                        ) : !item.evidenceComplete ? (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.missingCount > 0 && `${item.missingCount} missing`}
                            {item.missingCount > 0 && item.expiredCount > 0 && ' · '}
                            {item.expiredCount > 0 && `${item.expiredCount} expired`}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium space-x-2 whitespace-nowrap">
                        <Link
                          href={`/suppliers/${item.id}`}
                          className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {canGrant && (
                          <button
                            type="button"
                            disabled={
                              busy || !item.canApprove || !item.evidenceComplete
                            }
                            title={
                              !item.canApprove
                                ? 'Cannot grant operational trust for your own supplier'
                                : !item.evidenceComplete
                                  ? 'EWP readiness checks incomplete'
                                  : OPERATIONAL_TRUST_LABELS.grantAction
                            }
                            onClick={() => void handleGrantTrust(item)}
                            className="btn btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {OPERATIONAL_TRUST_LABELS.grantAction}
                          </button>
                        )}
                        {canSuspend && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setRejectTarget(item);
                              setRejectReason('');
                              setRejectError('');
                            }}
                            className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            {OPERATIONAL_TRUST_LABELS.denyAction}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason('');
          setRejectError('');
        }}
        title="Suspend supplier"
        size="md"
      >
        {rejectTarget && (
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Suspending <strong>{formatSupplierDisplayName(rejectTarget)}</strong> denies Operational
              Trust. The supplier will not participate in EWP until governance restores trust. A
              reviewer note is required for audit.
            </p>
            <FormTextarea
              label="Reviewer note"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              error={rejectError}
              required
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === rejectTarget.id}
                className="btn btn-primary"
              >
                {processingId === rejectTarget.id ? 'Suspending…' : 'Confirm suspend'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
