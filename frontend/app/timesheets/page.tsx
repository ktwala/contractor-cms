'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormTextarea from '@/components/ui/form-textarea';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Search, Clock, CheckCircle, XCircle, Eye, CheckSquare, Square, Download } from 'lucide-react';
import { format } from 'date-fns';
import { exportTimesheetsToCSV } from '@/lib/csv-export';

interface Timesheet {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
  engagement?: {
    title: string;
    contract?: {
      contractor?: {
        firstName: string;
        lastName: string;
      };
    };
  };
  project?: {
    name: string;
  };
}

export default function TimesheetsPage() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { showToast } = useToast();

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');

  useEffect(() => {
    loadTimesheets();
  }, [statusFilter]);

  useEffect(() => {
    // Clear selection when filter changes
    setSelectedIds([]);
  }, [statusFilter]);

  const loadTimesheets = async () => {
    try {
      const params: any = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.getTimesheets(params);
      setTimesheets(response.data);
    } catch (err: any) {
      showToast('error', 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((tsId) => tsId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === timesheets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(timesheets.map((ts) => ts.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to approve ${selectedIds.length} timesheet(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.approveTimesheet(id))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (succeeded > 0) {
        showToast('success', `${succeeded} timesheet(s) approved successfully`);
      }
      if (failed > 0) {
        showToast('error', `${failed} timesheet(s) failed to approve`);
      }

      setSelectedIds([]);
      loadTimesheets();
    } catch (err: any) {
      showToast('error', 'Failed to approve timesheets');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkRejectionReason.trim()) {
      showToast('error', 'Please provide a rejection reason');
      return;
    }

    setBulkActionLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.rejectTimesheet(id, bulkRejectionReason))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (succeeded > 0) {
        showToast('success', `${succeeded} timesheet(s) rejected successfully`);
      }
      if (failed > 0) {
        showToast('error', `${failed} timesheet(s) failed to reject`);
      }

      setSelectedIds([]);
      setBulkRejectionReason('');
      setShowBulkRejectModal(false);
      loadTimesheets();
    } catch (err: any) {
      showToast('error', 'Failed to reject timesheets');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleQuickApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this timesheet?')) return;

    try {
      await api.approveTimesheet(id);
      showToast('success', 'Timesheet approved successfully');
      loadTimesheets();
    } catch (err: any) {
      showToast('error', 'Failed to approve timesheet');
    }
  };

  const handleQuickReject = async (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      await api.rejectTimesheet(id, reason);
      showToast('success', 'Timesheet rejected');
      loadTimesheets();
    } catch (err: any) {
      showToast('error', 'Failed to reject timesheet');
    }
  };

  const getStatusBadgeVariant = (status: string): any => {
    switch (status) {
      case 'DRAFT':
        return undefined;
      case 'SUBMITTED':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return undefined;
    }
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

  const canBulkApprove = selectedIds.length > 0 && statusFilter === 'SUBMITTED';
  const canBulkReject = selectedIds.length > 0 && statusFilter === 'SUBMITTED';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
            <p className="text-gray-600 mt-1">Track and approve contractor hours</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportTimesheetsToCSV(timesheets)}
              className="btn btn-secondary flex items-center"
              disabled={timesheets.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => router.push('/timesheets/new')}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Timesheet
            </button>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
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
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
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
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  statusFilter === 'REJECTED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Rejected
              </button>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
                {canBulkApprove && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkActionLoading}
                    className="btn btn-primary flex items-center text-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve All
                  </button>
                )}
                {canBulkReject && (
                  <button
                    onClick={() => setShowBulkRejectModal(true)}
                    disabled={bulkActionLoading}
                    className="btn btn-danger flex items-center text-sm"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject All
                  </button>
                )}
              </div>
            )}
          </div>

          {timesheets.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {statusFilter
                  ? `No ${statusFilter.toLowerCase()} timesheets found`
                  : 'No timesheets yet'}
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
                        {selectedIds.length === timesheets.length ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contractor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hours
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
                  {timesheets.map((timesheet) => (
                    <tr key={timesheet.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleSelection(timesheet.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {selectedIds.includes(timesheet.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(timesheet.periodStart), 'MMM dd')} -{' '}
                          {format(new Date(timesheet.periodEnd), 'MMM dd, yyyy')}
                        </div>
                        {timesheet.submittedAt && (
                          <div className="text-xs text-gray-500">
                            Submitted {format(new Date(timesheet.submittedAt), 'MMM dd')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {timesheet.engagement?.contract?.contractor && (
                          <div className="text-sm text-gray-900">
                            {timesheet.engagement.contract.contractor.firstName}{' '}
                            {timesheet.engagement.contract.contractor.lastName}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">{timesheet.engagement?.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {timesheet.project?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {timesheet.totalHours}h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge
                          status={timesheet.status}
                          variant={getStatusBadgeVariant(timesheet.status)}
                        />
                        {timesheet.rejectionReason && (
                          <div className="text-xs text-red-600 mt-1">
                            {timesheet.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => router.push(`/timesheets/${timesheet.id}`)}
                          className="text-primary-600 hover:text-primary-900"
                          title="View details"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        {timesheet.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleQuickApprove(timesheet.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => handleQuickReject(timesheet.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">Showing {timesheets.length} timesheets</div>
      </div>

      {/* Bulk Reject Modal */}
      <Modal
        isOpen={showBulkRejectModal}
        onClose={() => setShowBulkRejectModal(false)}
        title={`Reject ${selectedIds.length} Timesheet(s)`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting these timesheets. This will be visible to the
            contractors.
          </p>

          <FormTextarea
            label="Rejection Reason"
            value={bulkRejectionReason}
            onChange={(e) => setBulkRejectionReason(e.target.value)}
            placeholder="e.g., Hours don't match project records, missing descriptions..."
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={() => setShowBulkRejectModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkReject}
              disabled={bulkActionLoading || !bulkRejectionReason.trim()}
              className="btn btn-danger"
            >
              {bulkActionLoading ? 'Rejecting...' : 'Reject Timesheets'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
