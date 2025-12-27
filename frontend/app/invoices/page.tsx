'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Search, FileText, Eye, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  paidAt?: string;
  paidAmount?: number;
  paymentReference?: string;
  voidReason?: string;
  engagement?: {
    title: string;
    contract?: {
      contractor?: {
        firstName: string;
        lastName: string;
      };
    };
  };
  timesheets?: Array<{
    id: string;
    totalHours: number;
  }>;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      const params: any = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.getInvoices(params);
      setInvoices(response.data);
    } catch (err: any) {
      showToast('error', 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this invoice?')) return;

    try {
      await api.approveInvoice(id);
      showToast('success', 'Invoice approved successfully');
      loadInvoices();
    } catch (err: any) {
      showToast('error', 'Failed to approve invoice');
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
      (invoice.engagement?.contract?.contractor &&
        `${invoice.engagement.contract.contractor.firstName} ${invoice.engagement.contract.contractor.lastName}`
          .toLowerCase()
          .includes(searchLower))
    );
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getTotalHours = (timesheets: any[]) => {
    if (!timesheets) return 0;
    return timesheets.reduce((sum, ts) => sum + ts.totalHours, 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600 mt-1">Manage contractor invoices and payments</p>
          </div>
          <button
            onClick={() => router.push('/invoices/new')}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </button>
        </div>

        <div className="card">
          <div className="mb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice number or contractor..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setStatusFilter('')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === ''
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('DRAFT')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'DRAFT'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pending Approval
              </button>
              <button
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'APPROVED'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'PAID'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Paid
              </button>
              <button
                onClick={() => setStatusFilter('VOID')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'VOID'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Void
              </button>
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter
                  ? 'No invoices found matching your criteria'
                  : 'No invoices yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contractor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-sm text-gray-500">{invoice.engagement?.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {invoice.engagement?.contract?.contractor && (
                          <div className="text-sm text-gray-900">
                            {invoice.engagement.contract.contractor.firstName}{' '}
                            {invoice.engagement.contract.contractor.lastName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Issued: {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}</div>
                        <div className="text-xs text-gray-400">
                          Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getTotalHours(invoice.timesheets || [])}h
                        </div>
                        <div className="text-xs text-gray-500">
                          {invoice.timesheets?.length || 0} timesheet(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                        {invoice.paidAt && invoice.paidAmount && (
                          <div className="text-xs text-green-600">
                            Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={invoice.status} />
                        {invoice.voidReason && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                            {invoice.voidReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                          className="text-primary-600 hover:text-primary-900"
                          title="View details"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        {invoice.status === 'PENDING' && (
                          <button
                            onClick={() => handleQuickApprove(invoice.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
      </div>
    </DashboardLayout>
  );
}
