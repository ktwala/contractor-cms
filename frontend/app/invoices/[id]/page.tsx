'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormTextarea from '@/components/ui/form-textarea';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  CheckCircle,
  XCircle,
  DollarSign,
  ArrowLeft,
  FileText,
  Download,
  Clock,
} from 'lucide-react';
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
  notes?: string;
  paidAt?: string;
  paidAmount?: number;
  paymentReference?: string;
  paymentMethod?: string;
  voidAt?: string;
  voidReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  engagement?: {
    title: string;
    rate: number;
    rateType: string;
    contract?: {
      contractNumber: string;
      contractor?: {
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  };
  timesheets?: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    totalHours: number;
  }>;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [paymentData, setPaymentData] = useState({
    paidAmount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentReference: '',
    paymentMethod: 'BANK_TRANSFER',
  });

  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  const loadInvoice = async () => {
    try {
      const response = await api.getInvoices({ page: 1, limit: 1 });
      const inv = response.data.find((i: any) => i.id === params.id);
      if (inv) {
        setInvoice(inv);
        setPaymentData({
          ...paymentData,
          paidAmount: inv.totalAmount.toString(),
        });
      } else {
        showToast('error', 'Invoice not found');
        router.push('/invoices');
      }
    } catch (err: any) {
      showToast('error', 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!invoice) return;
    if (!confirm('Are you sure you want to approve this invoice?')) return;

    setActionLoading(true);
    try {
      await api.approveInvoice(invoice.id);
      showToast('success', 'Invoice approved successfully');
      loadInvoice();
    } catch (err: any) {
      showToast('error', 'Failed to approve invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;

    setActionLoading(true);
    try {
      await api.markInvoicePaid(invoice.id, {
        paidAmount: parseFloat(paymentData.paidAmount),
        paymentDate: paymentData.paymentDate,
        paymentReference: paymentData.paymentReference,
        paymentMethod: paymentData.paymentMethod,
      });
      showToast('success', 'Invoice marked as paid');
      setShowPaymentModal(false);
      loadInvoice();
    } catch (err: any) {
      showToast('error', 'Failed to mark invoice as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice || !voidReason.trim()) {
      showToast('error', 'Please provide a void reason');
      return;
    }

    setActionLoading(true);
    try {
      await api.voidInvoice(invoice.id, voidReason);
      showToast('success', 'Invoice voided');
      setShowVoidModal(false);
      setVoidReason('');
      loadInvoice();
    } catch (err: any) {
      showToast('error', 'Failed to void invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    try {
      showToast('info', 'Generating PDF...');
      const pdfData = await api.downloadInvoicePDF(invoice.id);

      // Create blob and download
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      showToast('success', 'PDF downloaded successfully');
    } catch (err: any) {
      showToast('error', 'Failed to download PDF');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getTotalHours = () => {
    if (!invoice?.timesheets) return 0;
    return invoice.timesheets.reduce((sum, ts) => sum + ts.totalHours, 0);
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

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Invoice not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/invoices')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h1>
              <p className="text-gray-600 mt-1">
                Issued {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <StatusBadge status={invoice.status} />
            <button
              onClick={handleDownloadPDF}
              className="btn btn-secondary flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </button>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
              {invoice.engagement?.contract?.contractor && (
                <>
                  <p className="text-gray-900">
                    {invoice.engagement.contract.contractor.firstName}{' '}
                    {invoice.engagement.contract.contractor.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {invoice.engagement.contract.contractor.email}
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract</label>
              {invoice.engagement?.contract && (
                <p className="text-gray-900">{invoice.engagement.contract.contractNumber}</p>
              )}
              <p className="text-sm text-gray-500">{invoice.engagement?.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <p className="text-gray-900">
                {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <p className="text-gray-900">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</p>
              {new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' && (
                <p className="text-xs text-red-600 mt-1">Overdue</p>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <p className="text-gray-600 text-sm">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Timesheets */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Timesheets</h2>
          <div className="space-y-2">
            {invoice.timesheets && invoice.timesheets.length > 0 ? (
              invoice.timesheets.map((timesheet) => (
                <div
                  key={timesheet.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {format(new Date(timesheet.periodStart), 'MMM dd')} -{' '}
                      {format(new Date(timesheet.periodEnd), 'MMM dd, yyyy')}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{timesheet.totalHours}h</div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No timesheets</p>
            )}
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="card bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">Amount</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total Hours</span>
              <span className="font-medium text-gray-900">{getTotalHours()}h</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">
                Rate ({invoice.engagement?.rateType})
              </span>
              <span className="font-medium text-gray-900">
                {invoice.engagement &&
                  formatCurrency(invoice.engagement.rate, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoice.amount, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Tax</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoice.taxAmount, invoice.currency)}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Total Amount</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(invoice.totalAmount, invoice.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & Status History */}
        {(invoice.approvedAt || invoice.paidAt || invoice.voidAt) && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Status History</h2>
            <div className="space-y-3">
              {invoice.approvedAt && (
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Approved</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(invoice.approvedAt), 'MMM dd, yyyy at HH:mm')}
                    </p>
                  </div>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex items-start space-x-3">
                  <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Payment Received</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(invoice.paidAt), 'MMM dd, yyyy')}
                    </p>
                    {invoice.paidAmount && (
                      <p className="text-sm text-gray-600 mt-1">
                        Amount: {formatCurrency(invoice.paidAmount, invoice.currency)}
                      </p>
                    )}
                    {invoice.paymentReference && (
                      <p className="text-sm text-gray-600">Ref: {invoice.paymentReference}</p>
                    )}
                    {invoice.paymentMethod && (
                      <p className="text-sm text-gray-600">
                        Method: {invoice.paymentMethod.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {invoice.voidAt && (
                <div className="flex items-start space-x-3">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Voided</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(invoice.voidAt), 'MMM dd, yyyy at HH:mm')}
                    </p>
                    {invoice.voidReason && (
                      <p className="text-sm text-gray-600 mt-1">{invoice.voidReason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          {invoice.status === 'PENDING' && (
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="btn btn-primary flex items-center"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Invoice
            </button>
          )}

          {invoice.status === 'APPROVED' && (
            <>
              <button
                onClick={() => setShowVoidModal(true)}
                disabled={actionLoading}
                className="btn btn-danger flex items-center"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Void
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={actionLoading}
                className="btn btn-primary flex items-center"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Mark as Paid
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Mark Invoice as Paid"
      >
        <div className="space-y-4">
          <FormInput
            label="Payment Amount"
            type="number"
            step="0.01"
            value={paymentData.paidAmount}
            onChange={(e) => setPaymentData({ ...paymentData, paidAmount: e.target.value })}
            required
          />

          <FormInput
            label="Payment Date"
            type="date"
            value={paymentData.paymentDate}
            onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
            required
          />

          <FormInput
            label="Payment Reference"
            value={paymentData.paymentReference}
            onChange={(e) =>
              setPaymentData({ ...paymentData, paymentReference: e.target.value })
            }
            placeholder="e.g., Transfer confirmation number"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              className="input"
              value={paymentData.paymentMethod}
              onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
            >
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHECK">Check</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={actionLoading}
              className="btn btn-primary"
            >
              Mark as Paid
            </button>
          </div>
        </div>
      </Modal>

      {/* Void Modal */}
      <Modal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)} title="Void Invoice">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for voiding this invoice. This action cannot be undone.
          </p>

          <FormTextarea
            label="Void Reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g., Duplicate invoice, incorrect amount, cancelled contract..."
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={() => setShowVoidModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVoid}
              disabled={actionLoading || !voidReason.trim()}
              className="btn btn-danger"
            >
              Void Invoice
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
