'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import {
  getSupplierPortalErrorMessage,
  isSupplierPortalLoadFailure,
} from '@/lib/supplier-portal-errors';
import { unwrapSupplierPortalData, unwrapSupplierPortalList } from '@/lib/supplier-portal-response';
import { SUPPLIER_PORTAL_CONTRACTOR_READ } from '@/lib/supplier-portal-permissions';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import { formatWorkforceState, workforceStateBadgeClass } from '@/lib/workforce-state';
import { WorkforceHistoryEntry } from '@/lib/contractor-workforce-review';
import ContractorWorkforceTimeline from '@/components/workforce/ContractorWorkforceTimeline';
import { INTERNAL_ACCOUNTABILITY_LABELS } from '@/lib/external-workforce-labels';
import { ArrowLeft } from 'lucide-react';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { safeString, safeReplace, safeFormatDate } from '@/lib/safe-string';

interface PortalContractorDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  workerClassification?: string;
  engagementModel?: string;
  taxResidency?: string;
  workforceState?: string;
  isActive?: boolean;
  engagements?: Array<{
    id: string;
    role: string;
    startDate: string;
    endDate?: string | null;
    rateType: string;
    rateAmount: string | number;
    currency?: string;
    responsibleManagerEmployeeId?: string | null;
    contract?: {
      contractNumber: string;
      title: string;
    };
  }>;
}

export default function SupplierPortalContractorDetailPage() {
  const params = useParams<{ id: string }>();
  const contractorId = params?.id ?? '';
  const { ready, supplierLinked, guardApiCall } = useSupplierPortalGate();
  const [contractor, setContractor] = useState<PortalContractorDetail | null>(null);
  const [timeline, setTimeline] = useState<WorkforceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineError, setTimelineError] = useState('');

  const loadContractor = useCallback(async () => {
    if (!contractorId || !guardApiCall(true)) {
      setLoading(false);
      setTimelineLoading(false);
      return;
    }
    setLoading(true);
    setTimelineLoading(true);
    setError('');
    setTimelineError('');
    try {
      const contractorRes = await supplierPortalApi.getContractor(contractorId);
      setContractor(unwrapSupplierPortalData<PortalContractorDetail>(contractorRes));
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(err, 'The server could not load this contractor.'),
        );
      }
    } finally {
      setLoading(false);
    }

    try {
      const timelineRes = await supplierPortalApi.getContractorWorkforceHistory(contractorId);
      const { items } = unwrapSupplierPortalList<WorkforceHistoryEntry>(timelineRes);
      setTimeline(items);
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setTimelineError(
          getSupplierPortalErrorMessage(err, 'The server could not load workforce timeline.'),
        );
      }
    } finally {
      setTimelineLoading(false);
    }
  }, [contractorId, guardApiCall]);

  useEffect(() => {
    if (ready) loadContractor();
  }, [ready, loadContractor]);

  const engagement = contractor?.engagements?.[0];

  return (
    <RequirePermission permission={SUPPLIER_PORTAL_CONTRACTOR_READ}>
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <Link
            href="/supplier-portal/contractors"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {EXTERNAL_WORKFORCE_LABELS.workers.toLowerCase()}
          </Link>

          {supplierLinked && loading && (
            <p className="text-sm text-gray-500">Loading {EXTERNAL_WORKFORCE_LABELS.worker}…</p>
          )}
          {supplierLinked && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {supplierLinked && !loading && contractor && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {EXTERNAL_WORKFORCE_LABELS.worker}
              </p>
              <PortalPageHeader
                title={`${safeString(contractor.firstName)} ${safeString(contractor.lastName)}`}
                description={contractor.email}
              />

              <div className="card space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-500">Workforce state</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workforceStateBadgeClass(contractor.workforceState)}`}
                  >
                    {formatWorkforceState(contractor.workforceState)}
                  </span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Classification</dt>
                    <dd className="font-medium text-gray-900">
                      {safeReplace(contractor.workerClassification, /_/g, ' ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Engagement model</dt>
                    <dd className="font-medium text-gray-900">
                      {contractor.engagementModel || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Tax residency</dt>
                    <dd className="font-medium text-gray-900">{contractor.taxResidency || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="font-medium text-gray-900">{contractor.phone || '—'}</dd>
                  </div>
                </dl>
              </div>

              {engagement && (
                <div className="card space-y-3">
                  <h2 className="text-base font-semibold text-gray-900">Placement intent</h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Contract</dt>
                      <dd className="font-medium text-gray-900">
                        {engagement.contract
                          ? `${engagement.contract.contractNumber} — ${engagement.contract.title}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Role</dt>
                      <dd className="font-medium text-gray-900">{engagement.role}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Start date</dt>
                      <dd className="font-medium text-gray-900">
                        {safeFormatDate(engagement.startDate, 'MMM dd, yyyy')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Rate</dt>
                      <dd className="font-medium text-gray-900">
                        {engagement.rateType} {String(engagement.rateAmount)}{' '}
                        {engagement.currency ?? 'ZAR'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">{INTERNAL_ACCOUNTABILITY_LABELS.role}</dt>
                      <dd className="font-medium text-gray-900 break-all">
                        {engagement.responsibleManagerEmployeeId ||
                          INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {contractor.workforceState === 'NOMINATED' && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                  This worker is nominated and awaiting internal operations review. Activation
                  happens outside the supplier portal.
                </p>
              )}

              {contractor.workforceState === 'REJECTED' && (
                <p className="text-sm text-rose-800 bg-rose-50 rounded-lg px-4 py-3">
                  This nomination was rejected during operations review. Correct the details and
                  wait for ops to reopen, or contact your supplier manager. You cannot change
                  workforce state from the portal.
                </p>
              )}

              <div className="card space-y-3">
                <h2 className="text-base font-semibold text-gray-900">
                  {EXTERNAL_WORKFORCE_LABELS.workforceTimeline}
                </h2>
                <p className="text-sm text-gray-600">
                  Read-only view of how this external worker entered and moved through workforce
                  states. Suppliers can view this narrative but cannot advance workforce state.
                </p>
                {timelineError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
                    {timelineError}
                  </p>
                )}
                {!timelineError && (
                  <ContractorWorkforceTimeline
                    entries={timeline}
                    loading={timelineLoading}
                    showReason
                  />
                )}
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
