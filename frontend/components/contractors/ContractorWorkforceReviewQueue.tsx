'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/modal';
import FormTextarea from '@/components/ui/form-textarea';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import {
  ContractorWorkforceReviewQueueItem,
  ContractorWorkforceTimelineResponse,
  OpsWorkforceAction,
  WorkforceHistoryEntry,
  opsReviewAdvanceAction,
  opsReviewOutcomeActions,
  parseWorkforceTransitionError,
} from '@/lib/contractor-workforce-review';
import { formatWorkforceState, workforceStateBadgeClass } from '@/lib/workforce-state';
import { safeFormatDate } from '@/lib/safe-string';
import ContractorWorkforceTimeline from '@/components/workforce/ContractorWorkforceTimeline';
import { CheckCircle, ChevronDown, ChevronRight, ClipboardList, RotateCcw, ShieldBan, XCircle } from 'lucide-react';
import { EXTERNAL_WORKFORCE_LABELS, INTERNAL_ACCOUNTABILITY_LABELS } from '@/lib/external-workforce-labels';

function ContractorWorkforceTimelineLoader({ contractorId }: { contractorId: string }) {
  const [entries, setEntries] = useState<WorkforceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getContractorWorkforceHistory(contractorId)
      .then((res: ContractorWorkforceTimelineResponse) => {
        if (!cancelled) setEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  return <ContractorWorkforceTimeline entries={entries} loading={loading} />;
}

export default function ContractorWorkforceReviewQueue() {
  const { showToast } = useToast();
  const { can } = useAuth();
  const canUpdate = can(PERMISSIONS.CONTRACTORS.UPDATE);

  const [items, setItems] = useState<ContractorWorkforceReviewQueueItem[]>([]);
  const [rejectedItems, setRejectedItems] = useState<ContractorWorkforceReviewQueueItem[]>([]);
  const [blacklistEligibleItems, setBlacklistEligibleItems] = useState<
    ContractorWorkforceReviewQueueItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'ALL' | 'NOMINATED' | 'PENDING_APPROVAL'>('ALL');

  const [actionTarget, setActionTarget] = useState<{
    item: ContractorWorkforceReviewQueueItem;
    action: OpsWorkforceAction;
  } | null>(null);
  const [operatorNote, setOperatorNote] = useState('');
  const [authorityNote, setAuthorityNote] = useState('');
  const [actionError, setActionError] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        stateFilter === 'ALL' ? undefined : { workforceState: stateFilter };
      const [reviewRes, rejectedRes, blacklistRes] = await Promise.all([
        api.getContractorWorkforceReviewQueue(params),
        api.getContractorWorkforceRejected(),
        api.getContractorWorkforceBlacklistEligible(),
      ]);
      setItems(reviewRes.data ?? []);
      setRejectedItems(rejectedRes.data ?? []);
      setBlacklistEligibleItems(blacklistRes.data ?? []);
    } catch {
      showToast('error', 'Failed to load workforce review queue');
    } finally {
      setLoading(false);
    }
  }, [showToast, stateFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openAction = (
    item: ContractorWorkforceReviewQueueItem,
    action: OpsWorkforceAction,
  ) => {
    setActionTarget({ item, action });
    setOperatorNote('');
    setAuthorityNote('');
    setActionError('');
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;

    const reason = operatorNote.trim();
    const authority = authorityNote.trim();
    if (!reason) {
      setActionError('Reason is required for this workforce action');
      return;
    }
    if (actionTarget.action.requiresAuthorityNote && !authority) {
      setActionError(`Authority note is required when blacklisting an ${EXTERNAL_WORKFORCE_LABELS.worker}`);
      return;
    }

    setProcessingId(actionTarget.item.id);
    setActionError('');
    try {
      await api.transitionContractorWorkforceState(actionTarget.item.id, {
        targetState: actionTarget.action.targetState,
        reason,
        authorityNote: actionTarget.action.requiresAuthorityNote ? authority : undefined,
      });
      showToast('success', `${actionTarget.action.label} completed`);
      setActionTarget(null);
      setOperatorNote('');
      setAuthorityNote('');
      await loadQueue();
    } catch (err) {
      setActionError(parseWorkforceTransitionError(err));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading workforce review queue…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 inline-flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-gray-600" />
          {EXTERNAL_WORKFORCE_LABELS.workforceReview}
        </h1>
        <p className="text-gray-600 mt-1">
          Review supplier-nominated external workers before activation. Ops review advances workforce
          state — it is not yet an approval workflow engine.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'NOMINATED', 'PENDING_APPROVAL'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${stateFilter === value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStateFilter(value)}
          >
            {value === 'ALL' ? 'All pending' : formatWorkforceState(value)}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No external workers awaiting workforce review.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {EXTERNAL_WORKFORCE_LABELS.worker}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Placement
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => {
                  const busy = processingId === item.id;
                  const expanded = expandedId === item.id;
                  const advanceAction = opsReviewAdvanceAction(item);
                  const outcomeActions = opsReviewOutcomeActions(item);
                  const canAct =
                    canUpdate && (advanceAction || outcomeActions.length > 0);

                  return (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-label={expanded ? 'Collapse details' : 'Expand details'}
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            className="text-gray-500 hover:text-gray-800"
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{item.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.supplierDisplayName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workforceStateBadgeClass(item.workforceState)}`}
                          >
                            {formatWorkforceState(item.workforceState)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.placementIntent ? (
                            <>
                              <div>{item.placementIntent.role}</div>
                              <div className="text-xs text-gray-500">
                                {item.placementIntent.contractNumber}
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canAct && (
                            <div className="flex flex-wrap justify-end gap-2">
                              {advanceAction && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openAction(item, advanceAction)}
                                  className={`btn btn-sm inline-flex items-center gap-1 ${advanceAction.buttonClass ?? 'btn-primary'}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  {advanceAction.label}
                                </button>
                              )}
                              {outcomeActions.map((action) => (
                                <button
                                  key={action.kind}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openAction(item, action)}
                                  className={`btn btn-sm inline-flex items-center gap-1 ${action.buttonClass ?? 'btn-secondary'}`}
                                >
                                  {action.kind === 'REJECT' ? (
                                    <XCircle className="w-4 h-4" />
                                  ) : action.kind === 'BLACKLIST' ? (
                                    <ShieldBan className="w-4 h-4" />
                                  ) : (
                                    <RotateCcw className="w-4 h-4" />
                                  )}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                  Placement intent
                                </h3>
                                {item.placementIntent ? (
                                  <dl className="text-sm space-y-1">
                                    <div>
                                      <dt className="text-gray-500 inline">Contract: </dt>
                                      <dd className="inline text-gray-900">
                                        {item.placementIntent.contractNumber} —{' '}
                                        {item.placementIntent.contractTitle}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 inline">Role: </dt>
                                      <dd className="inline text-gray-900">
                                        {item.placementIntent.role}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 inline">Start: </dt>
                                      <dd className="inline text-gray-900">
                                        {safeFormatDate(item.placementIntent.startDate)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 inline">Rate: </dt>
                                      <dd className="inline text-gray-900">
                                        {item.placementIntent.rateType}{' '}
                                        {item.placementIntent.rateAmount}{' '}
                                        {item.placementIntent.currency}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 inline">
                                        {INTERNAL_ACCOUNTABILITY_LABELS.role}:{' '}
                                      </dt>
                                      <dd className="inline text-gray-900 break-all">
                                        {item.placementIntent.responsibleManagerEmployeeId ||
                                          INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline}
                                      </dd>
                                    </div>
                                  </dl>
                                ) : (
                                  <p className="text-sm text-gray-500">No placement recorded.</p>
                                )}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                  {EXTERNAL_WORKFORCE_LABELS.workforceTimeline}
                                </h3>
                                <ContractorWorkforceTimelineLoader contractorId={item.id} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectedItems.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Rejected nominations</h2>
            <p className="text-sm text-gray-600">
              Not in the active review queue. Reopen to return the same record to NOMINATED after
              supplier correction.
            </p>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {EXTERNAL_WORKFORCE_LABELS.worker}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rejectedItems.map((item) => {
                    const reopenAction = opsReviewAdvanceAction(item);
                    const busy = processingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{item.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.supplierDisplayName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workforceStateBadgeClass(item.workforceState)}`}
                          >
                            {formatWorkforceState(item.workforceState)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canUpdate && (
                            <div className="flex flex-wrap justify-end gap-2">
                              {reopenAction && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openAction(item, reopenAction)}
                                  className="btn btn-primary btn-sm inline-flex items-center gap-1"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  {reopenAction.label}
                                </button>
                              )}
                              {opsReviewOutcomeActions(item).map((action) => (
                                <button
                                  key={action.kind}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openAction(item, action)}
                                  className={`btn btn-sm inline-flex items-center gap-1 ${action.buttonClass ?? 'btn-secondary'}`}
                                >
                                  {action.kind === 'BLACKLIST' ? (
                                    <ShieldBan className="w-4 h-4" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {blacklistEligibleItems.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Policy block candidates</h2>
            <p className="text-sm text-gray-600">
              Active or terminated external workers eligible for workforce blacklist (ops-only; not
              access revocation or MTN disciplinary workflow).
            </p>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {EXTERNAL_WORKFORCE_LABELS.worker}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blacklistEligibleItems.map((item) => {
                    const blacklistAction = opsReviewOutcomeActions(item).find(
                      (a) => a.kind === 'BLACKLIST',
                    );
                    const busy = processingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{item.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workforceStateBadgeClass(item.workforceState)}`}
                          >
                            {formatWorkforceState(item.workforceState)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canUpdate && blacklistAction && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openAction(item, blacklistAction)}
                              className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                            >
                              <ShieldBan className="w-4 h-4" />
                              Blacklist
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
        </div>
      )}

      <p className="text-sm text-gray-500">
        Supplier portal path:{' '}
        <Link href="/contractors" className="text-primary-600 hover:underline">
          {EXTERNAL_WORKFORCE_LABELS.registry.toLowerCase()}
        </Link>
      </p>

      <Modal
        isOpen={Boolean(actionTarget)}
        onClose={() => {
          setActionTarget(null);
          setOperatorNote('');
          setAuthorityNote('');
          setActionError('');
        }}
        title={actionTarget ? actionTarget.action.label : 'Workforce action'}
        size="md"
      >
        {actionTarget && (
          <form onSubmit={handleActionSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>
                {actionTarget.item.firstName} {actionTarget.item.lastName}
              </strong>{' '}
              — {actionTarget.action.description}
            </p>
            <FormTextarea
              label="Reason"
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              error={actionError}
              required
              rows={3}
              helperText={
                actionTarget.action.requiresAuthorityNote
                  ? 'Required — recorded in workforce history.'
                  : 'Required — recorded in workforce history; portal-safe for reject, send-back, and reopen.'
              }
            />
            {actionTarget.action.requiresAuthorityNote && (
              <FormTextarea
                label="Authority note (internal)"
                value={authorityNote}
                onChange={(e) => setAuthorityNote(e.target.value)}
                required
                rows={3}
                helperText="Ops-only — stored in audit and history metadata; not shown on supplier portal."
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setActionTarget(null)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === actionTarget.item.id}
                className="btn btn-primary"
              >
                {processingId === actionTarget.item.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
