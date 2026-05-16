'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Search, FileText, Eye, CheckCircle, XCircle, CheckSquare, Square, Download } from 'lucide-react';
import { format } from 'date-fns';
import { exportInvoicesToCSV } from '@/lib/csv-export';
import { useDebounce } from '@/lib/hooks';
import DateRangeFilter from '@/components/ui/date-range-filter';
import { TableSkeleton } from '@/components/ui/skeleton';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { useAuth } from '@/lib/auth-context';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
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
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { showToast } = useToast();
  const { can } = useAuth();

  // Debounced search for better performance
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  useEffect(() => {
    // Clear selection when filter changes
    setSelectedIds([]);
  }, [statusFilter, debouncedSearch, startDate, endDate]);

  const loadInvoices = async () => {
    try {
      const params: any = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.getInvoices(params);
      setInvoices(response.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to load invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((invId) => invId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filtered = filteredInvoices;
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((inv) => inv.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to approve ${selectedIds.length} invoice(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.approveInvoice(id))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (succeeded > 0) {
        showToast('success', `${succeeded} invoice(s) approved successfully`);
      }
      if (failed > 0) {
        showToast('error', `${failed} invoice(s) failed to approve`);
      }

      setSelectedIds([]);
      loadInvoices();
    } catch (err: any) {
      showToast('error', 'Failed to approve invoices');
    } finally {
      setBulkActionLoading(false);
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
    // Search filter (using debounced value)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesInvoiceNumber = invoice.invoiceNumber.toLowerCase().includes(searchLower);
      const matchesContractor = invoice.engagement?.contract?.contractor &&
        `${invoice.engagement.contract.contractor.firstName} ${invoice.engagement.contract.contractor.lastName}`
          .toLowerCase()
          .includes(searchLower);

      if (!matchesInvoiceNumber && !matchesContractor) {
        return false;
      }
    }

    // Date range filter (based on invoice date)
    if (startDate) {
      const invoiceDate = new Date(invoice.invoiceDate);
      if (invoiceDate < new Date(startDate)) return false;
    }
    if (endDate) {
      const invoiceDate = new Date(invoice.invoiceDate);
      if (invoiceDate > new Date(endDate)) return false;
    }

    return true;
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

  const safeFormatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'Invalid Date' : format(d, 'MMM dd, yyyy');
  };

  const handleClearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600 mt-1">Manage contractor invoices and payments</p>
            </div>
          </div>
          <TableSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <RequirePermission permission={PERMISSIONS.INVOICES.READ}>
      <DashboardLayout>
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600 mt-1">Manage contractor invoices and payments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportInvoicesToCSV(filteredInvoices)}
              className="btn btn-secondary flex items-center"
              disabled={filteredInvoices.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>
            {can(PERMISSIONS.INVOICES.CREATE) && (
              <button
                onClick={() => router.push('/invoices/new')}
                className="btn btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="card">
          <div className="mb-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by invoice number or contractor..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-auto">
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onClear={handleClearDateRange}
                  label="Issue Date Range"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap ${
                  statusFilter === 'SUBMITTED'
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

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
                {statusFilter === 'SUBMITTED' && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkActionLoading || !can(PERMISSIONS.INVOICES.APPROVE)}
                    className="btn btn-primary flex items-center text-sm disabled:opacity-50"
                    title={!can(PERMISSIONS.INVOICES.APPROVE) ? "You don't have permission to approve invoices" : ""}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve All
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {debouncedSearch || statusFilter || startDate || endDate
                  ? 'No invoices match your filters'
                  : 'No invoices yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
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
                        <button
                          onClick={() => toggleSelection(invoice.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {selectedIds.includes(invoice.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
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
                        <div>Issued: {safeFormatDate(invoice.invoiceDate)}</div>
                        <div className="text-xs text-gray-400">
                          Due: {safeFormatDate(invoice.dueDate)}
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
                        {invoice.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleQuickApprove(invoice.id)}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!can(PERMISSIONS.INVOICES.APPROVE) ? "You don't have permission to approve invoices" : "Approve"}
                            disabled={!can(PERMISSIONS.INVOICES.APPROVE)}
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
    </RequirePermission>
  );
}
