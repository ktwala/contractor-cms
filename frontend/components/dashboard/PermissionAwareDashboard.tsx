'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Receipt, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import DashboardNavCards from './DashboardNavCards';
import { ContractRenewalsWidget } from './ContractRenewalsWidget';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { isSupplierPortalUser } from '@/lib/supplier-portal-modules';

interface TimesheetStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface InvoiceStats {
  total: number;
  outstandingAmount: number;
  paidAmount: number;
}

export default function PermissionAwareDashboard() {
  const { can, user } = useAuth();
  const portalUser = isSupplierPortalUser(can);
  const canClientTimesheets = can(PERMISSIONS.TIMESHEETS.READ);
  const canPortalTimesheets = can(PERMISSIONS.SUPPLIER_TIMESHEETS.READ);
  const canTimesheets = canClientTimesheets || canPortalTimesheets;
  const canInvoices = can(PERMISSIONS.INVOICES.READ);
  const canContracts = can(PERMISSIONS.CONTRACTS.READ);

  const [loading, setLoading] = useState(canTimesheets || canInvoices);
  const [error, setError] = useState('');
  const [timesheets, setTimesheets] = useState<TimesheetStats | null>(null);
  const [invoices, setInvoices] = useState<InvoiceStats | null>(null);

  const loadData = useCallback(async () => {
    if (!canTimesheets && !canInvoices) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const tasks: Promise<void>[] = [];

      if (canPortalTimesheets && portalUser) {
        tasks.push(
          supplierPortalApi.getTimesheets({ page: 1, limit: 100 }).then((res) => {
            const rows = res.data || [];
            setTimesheets({
              total: rows.length,
              pending: rows.filter((t: { status: string }) => t.status === 'SUBMITTED')
                .length,
              approved: rows.filter((t: { status: string }) => t.status === 'APPROVED')
                .length,
              rejected: rows.filter((t: { status: string }) => t.status === 'REJECTED')
                .length,
            });
          }),
        );
      } else if (canClientTimesheets) {
        tasks.push(
          api.getTimesheets().then((res) => {
            const rows = res.data || [];
            setTimesheets({
              total: rows.length,
              pending: rows.filter((t: { status: string }) => t.status === 'SUBMITTED')
                .length,
              approved: rows.filter((t: { status: string }) => t.status === 'APPROVED')
                .length,
              rejected: rows.filter((t: { status: string }) => t.status === 'REJECTED')
                .length,
            });
          }),
        );
      } else {
        setTimesheets(null);
      }

      if (canInvoices) {
        tasks.push(
          api.getInvoices().then((res) => {
            const rows = res.data || [];
            setInvoices({
              total: rows.length,
              outstandingAmount: rows
                .filter(
                  (i: { status: string }) =>
                    i.status === 'SUBMITTED' || i.status === 'APPROVED',
                )
                .reduce(
                  (sum: number, i: { totalAmount?: number }) =>
                    sum + Number(i.totalAmount || 0),
                  0,
                ),
              paidAmount: rows
                .filter((i: { status: string }) => i.status === 'PAID')
                .reduce(
                  (sum: number, i: { totalAmount?: number }) =>
                    sum + Number(i.totalAmount || 0),
                  0,
                ),
            });
          }),
        );
      } else {
        setInvoices(null);
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [canTimesheets, canInvoices, canClientTimesheets, canPortalTimesheets, portalUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

  const showStatsRow = canTimesheets || canInvoices;
  const showDetailPanels = canTimesheets || canInvoices;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            {user?.firstName
              ? `Welcome back, ${user.firstName}.`
              : 'Shortcuts and summaries for modules you can access.'}
          </p>
        </div>
        {can(PERMISSIONS.TIMESHEETS.CREATE) && (
          <Link href="/timesheets/new" className="btn btn-primary">
            Submit Timesheet
          </Link>
        )}
      </div>

      <DashboardNavCards />

      {loading && showStatsRow && (
        <div className="flex items-center justify-center h-24 text-gray-500">
          Loading summaries…
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {!loading && !error && showStatsRow && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {canTimesheets && timesheets && (
            <>
              <div className="card border-l-4 border-amber-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending Timesheets</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheets.pending}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>
              <div className="card border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Approved Timesheets</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheets.approved}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="card border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Rejected Timesheets</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheets.rejected}
                    </h3>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </>
          )}
          {canInvoices && invoices && (
            <div className="card border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Outstanding Invoices</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(invoices.outstandingAmount)}
                  </h3>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && showDetailPanels && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {canTimesheets && timesheets && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gray-400" />
                Timesheet Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Total Submitted</span>
                  <span className="font-semibold">{timesheets.total}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Awaiting Approval</span>
                  <span className="font-semibold text-amber-600">{timesheets.pending}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Approved</span>
                  <span className="font-semibold text-green-600">{timesheets.approved}</span>
                </div>
              </div>
              <div className="mt-6">
                <Link
                  href={
                    portalUser && canPortalTimesheets
                      ? '/supplier-portal/timesheets'
                      : '/timesheets'
                  }
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  View all timesheets →
                </Link>
              </div>
            </div>
          )}
          {canInvoices && invoices && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-gray-400" />
                Invoice Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Total Invoices</span>
                  <span className="font-semibold">{invoices.total}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(invoices.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount Outstanding</span>
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(invoices.outstandingAmount)}
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <Link
                  href="/invoices"
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  View all invoices →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {canContracts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <ContractRenewalsWidget />
          </div>
        </div>
      )}
    </div>
  );
}
