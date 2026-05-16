'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, Receipt, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface ContractorDashboardData {
  timesheets: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  invoices: {
    total: number;
    outstandingAmount: number;
    paidAmount: number;
  };
}

export default function ContractorDashboard() {
  const [data, setData] = useState<ContractorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadContractorData();
  }, []);

  const loadContractorData = async () => {
    try {
      // Use existing tenant-isolated endpoints
      const [timesheetsRes, invoicesRes] = await Promise.all([
        api.getTimesheets(),
        api.getInvoices()
      ]);

      const timesheets = timesheetsRes.data || [];
      const invoices = invoicesRes.data || [];

      // Aggregate on the frontend since these are already scoped to the contractor
      setData({
        timesheets: {
          total: timesheets.length,
          pending: timesheets.filter((t: any) => t.status === 'SUBMITTED').length,
          approved: timesheets.filter((t: any) => t.status === 'APPROVED').length,
          rejected: timesheets.filter((t: any) => t.status === 'REJECTED').length,
        },
        invoices: {
          total: invoices.length,
          outstandingAmount: invoices
            .filter((i: any) => i.status === 'SUBMITTED' || i.status === 'APPROVED')
            .reduce((sum: number, i: any) => sum + Number(i.totalAmount), 0),
          paidAmount: invoices
            .filter((i: any) => i.status === 'PAID')
            .reduce((sum: number, i: any) => sum + Number(i.totalAmount), 0),
        }
      });
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Your Workspace Overview</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your timesheets and invoices.</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/timesheets/new" className="btn btn-primary">
            Submit Timesheet
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Timesheets</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.timesheets.pending}
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
                {data.timesheets.approved}
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
                {data.timesheets.rejected}
              </h3>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Invoices</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(data.invoices.outstandingAmount)}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-400" />
            Timesheet Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Total Submitted</span>
              <span className="font-semibold">{data.timesheets.total}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Awaiting Approval</span>
              <span className="font-semibold text-amber-600">{data.timesheets.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Approved</span>
              <span className="font-semibold text-green-600">{data.timesheets.approved}</span>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/timesheets" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              View all timesheets &rarr;
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-gray-400" />
            Invoice Summary
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Total Invoices</span>
              <span className="font-semibold">{data.invoices.total}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-semibold text-green-600">{formatCurrency(data.invoices.paidAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount Outstanding</span>
              <span className="font-semibold text-amber-600">{formatCurrency(data.invoices.outstandingAmount)}</span>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/invoices" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              View all invoices &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
