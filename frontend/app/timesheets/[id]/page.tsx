'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormTextarea from '@/components/ui/form-textarea';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { CheckCircle, XCircle, Send, ArrowLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Timesheet {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  entries: Array<{
    date: string;
    hours: number;
    description: string;
  }>;
  engagement?: {
    title: string;
    rate: number;
    rateType: string;
    currency: string;
    contract?: {
      contractor?: {
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  };
  project?: {
    name: string;
    code: string;
  };
}

export default function TimesheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTimesheet();
  }, [params.id]);

  const loadTimesheet = async () => {
    try {
      const response = await api.getTimesheets({ page: 1, limit: 1 });
      // In a real app, we'd fetch by ID
      const ts = response.data.find((t: any) => t.id === params.id);
      if (ts) {
        setTimesheet(ts);
      } else {
        showToast('error', 'Timesheet not found');
        router.push('/timesheets');
      }
    } catch (err: any) {
      showToast('error', 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!timesheet) return;

    setActionLoading(true);
    try {
      await api.submitTimesheet(timesheet.id);
      showToast('success', 'Timesheet submitted for approval');
      loadTimesheet();
    } catch (err: any) {
      showToast('error', 'Failed to submit timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!timesheet) return;
    if (!confirm('Are you sure you want to approve this timesheet?')) return;

    setActionLoading(true);
    try {
      await api.approveTimesheet(timesheet.id);
      showToast('success', 'Timesheet approved successfully');
      loadTimesheet();
    } catch (err: any) {
      showToast('error', 'Failed to approve timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!timesheet || !rejectionReason.trim()) {
      showToast('error', 'Please provide a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      await api.rejectTimesheet(timesheet.id, rejectionReason);
      showToast('success', 'Timesheet rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      loadTimesheet();
    } catch (err: any) {
      showToast('error', 'Failed to reject timesheet');
    } finally {
      setActionLoading(false);
    }
  };

  const calculateEstimatedPayment = () => {
    if (!timesheet?.engagement) return 0;
    const rate = timesheet.engagement.rate;
    const hours = timesheet.totalHours;

    switch (timesheet.engagement.rateType) {
      case 'HOURLY':
        return rate * hours;
      case 'DAILY':
        return rate * (hours / 8); // Assuming 8-hour days
      default:
        return rate;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
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

  if (!timesheet) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Timesheet not found</p>
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
              onClick={() => router.push('/timesheets')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Timesheet Details</h1>
              <p className="text-gray-600 mt-1">
                {format(new Date(timesheet.periodStart), 'MMM dd')} -{' '}
                {format(new Date(timesheet.periodEnd), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          <StatusBadge status={timesheet.status} />
        </div>

        {/* Contractor & Project Info */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Information</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
              {timesheet.engagement?.contract?.contractor && (
                <>
                  <p className="text-gray-900">
                    {timesheet.engagement.contract.contractor.firstName}{' '}
                    {timesheet.engagement.contract.contractor.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {timesheet.engagement.contract.contractor.email}
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              {timesheet.project && (
                <>
                  <p className="text-gray-900">{timesheet.project.name}</p>
                  <p className="text-sm text-gray-500">{timesheet.project.code}</p>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engagement</label>
              <p className="text-gray-900">{timesheet.engagement?.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
              <p className="text-gray-900">
                {timesheet.engagement &&
                  formatCurrency(timesheet.engagement.rate, timesheet.engagement.currency)}{' '}
                <span className="text-gray-500 text-sm">
                  {timesheet.engagement?.rateType}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Time Entries */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Time Entries</h2>
          <div className="space-y-2">
            {timesheet.entries && timesheet.entries.length > 0 ? (
              timesheet.entries.map((entry, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-medium text-gray-900 w-32">
                        {format(new Date(entry.date), 'EEE, MMM dd')}
                      </div>
                      <div className="flex-1 text-sm text-gray-600">{entry.description}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 w-20 text-right">
                    {entry.hours}h
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No time entries</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Hours</span>
              <span className="text-lg font-bold text-gray-900">{timesheet.totalHours}h</span>
            </div>
            {timesheet.engagement && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Estimated Payment</span>
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(
                    calculateEstimatedPayment(),
                    timesheet.engagement.currency
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Info */}
        {(timesheet.submittedAt || timesheet.approvedAt || timesheet.rejectionReason) && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Status History</h2>
            <div className="space-y-3">
              {timesheet.submittedAt && (
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Submitted</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(timesheet.submittedAt), 'MMM dd, yyyy at HH:mm')}
                    </p>
                  </div>
                </div>
              )}
              {timesheet.approvedAt && (
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Approved</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(timesheet.approvedAt), 'MMM dd, yyyy at HH:mm')}
                    </p>
                  </div>
                </div>
              )}
              {timesheet.rejectionReason && (
                <div className="flex items-start space-x-3">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rejected</p>
                    <p className="text-sm text-gray-600 mt-1">{timesheet.rejectionReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          {timesheet.status === 'DRAFT' && (
            <button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="btn btn-primary flex items-center"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Approval
            </button>
          )}

          {timesheet.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="btn btn-danger flex items-center"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn btn-primary flex items-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Timesheet"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this timesheet. This will be visible to the
            contractor.
          </p>

          <FormTextarea
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g., Hours don't match project records, missing descriptions..."
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              className="btn btn-danger"
            >
              Reject Timesheet
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
