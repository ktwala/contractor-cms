'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, Receipt, Building2, Users } from 'lucide-react';
import Link from 'next/link';

interface FinanceDashboardData {
  invoices: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    totalAmount: number;
  };
  timesheets: {
    total: number;
    pending: number;
    approved: number;
  };
  suppliersCount: number;
  contractorsCount: number;
}

export default function FinanceDashboard() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      // Use existing endpoints the FINANCE_USER has access to
      const [invoicesRes, timesheetsRes, suppliersRes, contractorsRes] = await Promise.all([
        api.getInvoices().catch(() => ({ data: [] })),
        api.getTimesheets().catch(() => ({ data: [] })),
        api.getSuppliers().catch(() => ({ data: [] })),
        api.getContractors().catch(() => ({ data: [] }))
      ]);

      const invoices = invoicesRes.data || [];
      const timesheets = timesheetsRes.data || [];
      const suppliers = suppliersRes.data || [];
      const contractors = contractorsRes.data || [];

      setData({
        invoices: {
          total: invoices.length,
          pending: invoices.filter((i: any) => i.status === 'SUBMITTED').length,
          approved: invoices.filter((i: any) => i.status === 'APPROVED').length,
          paid: invoices.filter((i: any) => i.status === 'PAID').length,
          totalAmount: invoices.reduce((sum: number, i: any) => sum + Number(i.totalAmount || 0), 0)
        },
        timesheets: {
          total: timesheets.length,
          pending: timesheets.filter((t: any) => t.status === 'SUBMITTED').length,
          approved: timesheets.filter((t: any) => t.status === 'APPROVED').length,
        },
        suppliersCount: suppliers.length,
        contractorsCount: contractors.length,
      });
    } catch (err: any) {
      setError('Failed to load finance dashboard data');
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
        <div className="text-gray-500">Loading finance overview...</div>
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
          <h2 className="text-xl font-semibold text-gray-900">Finance & AP Overview</h2>
          <p className="text-sm text-gray-500 mt-1">Manage pending approvals and review operational expenditures.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Invoices Pending</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.invoices.pending}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <Receipt className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Timesheets Pending</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.timesheets.pending}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Clock className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Suppliers</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.suppliersCount}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Contractors</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.contractorsCount}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-gray-400" />
            Invoice Approvals
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Awaiting Approval</span>
              <span className="font-semibold text-amber-600">{data.invoices.pending}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Approved for Payment</span>
              <span className="font-semibold text-indigo-600">{data.invoices.approved}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Paid Invoices</span>
              <span className="font-semibold text-green-600">{data.invoices.paid}</span>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/invoices" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              Review invoices &rarr;
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-400" />
            Timesheet Approvals
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <span className="text-gray-600">Total Timesheets</span>
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
              Review timesheets &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
