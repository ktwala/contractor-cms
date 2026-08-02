'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import StatusBadge from '@/components/ui/status-badge';
import { PERMISSIONS } from '@/lib/permissions.generated';
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
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import { safeFormatDate } from '@/lib/safe-string';
import { FileText } from 'lucide-react';

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  totalAmount: string | null;
  financialFieldsRestricted?: boolean;
}

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function SupplierPortalInvoicesPage() {
  const { ready, supplierLinked, blockedMessage, guardApiCall } = useSupplierPortalGate();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInvoices = useCallback(async () => {
    if (!guardApiCall(true)) {
      setLoading(false);
      setInvoices([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await supplierPortalApi.getInvoices(params);
      const { items } = unwrapSupplierPortalList<PortalInvoice>(res);
      setInvoices(items);
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(
            err,
            'The server could not load invoices for your supplier.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, guardApiCall]);

  useEffect(() => {
    if (ready) loadInvoices();
  }, [ready, loadInvoices]);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_INVOICES.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title="Invoices"
            description="Read-only visibility of invoice status and billing periods for your supplier. Amounts are restricted to finance roles on the client side."
          />

          {supplierLinked && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-600" htmlFor="invoice-status-filter">
                Status
              </label>
              <select
                id="invoice-status-filter"
                className="input text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!supplierLinked && ready && (
            <PortalEmptyState
              icon={FileText}
              title={SUPPLIER_NOT_LINKED_TITLE}
              description={
                blockedMessage ?? 'No supplier membership is active for your account.'
              }
            />
          )}

          {supplierLinked && loading && (
            <p className="text-sm text-gray-500">Loading invoices…</p>
          )}

          {supplierLinked && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3" role="alert">
              {error}
            </p>
          )}

          {supplierLinked && !loading && !error && invoices.length === 0 && (
            <PortalEmptyState
              icon={FileText}
              title={
                statusFilter
                  ? 'No invoices match this filter'
                  : SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_INVOICES].title
              }
              description={
                statusFilter
                  ? 'No invoices match this status for your supplier.'
                  : SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_INVOICES]
                      .description
              }
            />
          )}

          {supplierLinked && !loading && invoices.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Invoice #</th>
                    <th className="py-2 pr-4">Period</th>
                    <th className="py-2 pr-4">Invoice date</th>
                    <th className="py-2 pr-4">Due</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">
                        {safeFormatDate(inv.periodStart, 'MMM dd, yyyy')} – {safeFormatDate(inv.periodEnd, 'MMM dd, yyyy')}
                      </td>
                      <td className="py-3 pr-4">{safeFormatDate(inv.invoiceDate, 'MMM dd, yyyy')}</td>
                      <td className="py-3 pr-4">{safeFormatDate(inv.dueDate, 'MMM dd, yyyy')}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {inv.financialFieldsRestricted || inv.totalAmount == null
                          ? 'Restricted'
                          : `${inv.currency} ${inv.totalAmount}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
