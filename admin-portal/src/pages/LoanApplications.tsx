import { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  Eye,
  X as XIcon,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface LoanApplication {
  id: string;
  application_number: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  loan_type_name: string;
  requested_amount: number;
  approved_amount?: number;
  tenure_months: number;
  purpose?: string;
  interest_rate: number;
  monthly_deduction?: number;
  total_repayment?: number;
  status: string;
  application_date: string;
  submission_date?: string;
  approval_date?: string;
  rejected_by?: string;
  rejection_reason?: string;
  guarantor_name?: string;
}

interface Statistics {
  total_applications: number;
  pending: number;
  approved: number;
  rejected: number;
  total_approved_amount: number;
  total_pending_amount: number;
  avg_loan_amount: number;
}

export default function LoanApplications() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending_approval');
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form data
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [appsRes, statsRes] = await Promise.all([
        api.get(`/loans/applications${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/loans/stats/applications'),
      ]);

      setApplications(appsRes.data || []);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Failed to load loan applications', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (app: LoanApplication) => {
    setSelectedApp(app);
    setShowDetailsModal(true);
  };

  const handleApproveClick = (app: LoanApplication) => {
    setSelectedApp(app);
    setApprovedAmount(app.requested_amount.toString());
    setComments('');
    setShowApproveModal(true);
  };

  const handleRejectClick = (app: LoanApplication) => {
    setSelectedApp(app);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    try {
      setActionLoading(true);

      const payload: any = {
        comments,
      };

      if (approvedAmount && parseFloat(approvedAmount) !== selectedApp.requested_amount) {
        payload.approved_amount = parseFloat(approvedAmount);
      }

      await api.post(`/loans/applications/${selectedApp.id}/approve`, payload);
      alert('Loan application approved successfully');
      setShowApproveModal(false);
      setSelectedApp(null);
      await loadData();
    } catch (error: any) {
      console.error('Failed to approve application', error);
      alert(error.response?.data?.message || 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);

      await api.post(`/loans/applications/${selectedApp.id}/reject`, {
        reason: rejectionReason,
      });

      alert('Loan application rejected');
      setShowRejectModal(false);
      setSelectedApp(null);
      await loadData();
    } catch (error: any) {
      console.error('Failed to reject application', error);
      alert(error.response?.data?.message || 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Submitted' },
      pending_approval: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      disbursed: { color: 'bg-purple-100 text-purple-800', icon: DollarSign, label: 'Disbursed' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' },
    };

    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading loan applications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loan Applications</h1>
        <p className="text-gray-600 mt-1">Review and approve employee loan applications</p>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.pending}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.approved}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_approved_amount)}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Loan Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.avg_loan_amount || 0)}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Applications</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {applications.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Application #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {app.application_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{app.employee_name}</span>
                        <span className="text-xs text-gray-500">{app.employee_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.loan_type_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(app.requested_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {app.tenure_months}m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(app.application_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(app.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(app)}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {app.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => handleApproveClick(app)}
                              className="text-green-600 hover:text-green-700"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRejectClick(app)}
                              className="text-red-600 hover:text-red-700"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedApp && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Application Details</h3>
                <p className="text-sm text-gray-600">{selectedApp.application_number}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Employee</p>
                  <p className="font-medium">{selectedApp.employee_name}</p>
                  <p className="text-sm text-gray-500">{selectedApp.employee_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Loan Type</p>
                  <p className="font-medium">{selectedApp.loan_type_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Requested Amount</p>
                  <p className="font-medium">{formatCurrency(selectedApp.requested_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tenure</p>
                  <p className="font-medium">{selectedApp.tenure_months} months</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly Deduction</p>
                  <p className="font-medium">{formatCurrency(selectedApp.monthly_deduction || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Repayment</p>
                  <p className="font-medium">{formatCurrency(selectedApp.total_repayment || 0)}</p>
                </div>
              </div>

              {selectedApp.purpose && (
                <div>
                  <p className="text-sm text-gray-600">Purpose</p>
                  <p className="text-sm text-gray-900">{selectedApp.purpose}</p>
                </div>
              )}

              {selectedApp.guarantor_name && (
                <div>
                  <p className="text-sm text-gray-600">Guarantor</p>
                  <p className="font-medium">{selectedApp.guarantor_name}</p>
                </div>
              )}

              {selectedApp.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-900">Rejection Reason</p>
                  <p className="text-sm text-red-800">{selectedApp.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedApp && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Approve Loan Application</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">{selectedApp.application_number}</p>
                <p className="text-sm text-blue-800">{selectedApp.employee_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approved Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter approved amount"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Requested: {formatCurrency(selectedApp.requested_amount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any comments..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reject Loan Application</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">{selectedApp.application_number}</p>
                    <p className="text-sm text-red-800">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please provide a clear reason for rejection..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
