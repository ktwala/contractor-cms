import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Eye,
  Check,
  X,
  FileCheck,
  Users,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface EmployeeBenefit {
  id: string;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  employee_number?: string;
  plan_id: string;
  plan_name?: string;
  provider_name?: string;
  enrollment_date: string;
  effective_date: string;
  status: 'pending_approval' | 'pending_documents' | 'active' | 'suspended' | 'cancelled' | 'rejected';
  employee_contribution: number;
  employer_contribution: number;
  total_contribution: number;
  is_custom_rate: boolean;
  documents_verified: boolean;
  created_by_name?: string;
  created_at: string;
}

interface Statistics {
  total_enrollments: number;
  active_enrollments: number;
  pending_approvals: number;
  pending_documents: number;
  total_monthly_cost: number;
}

export default function BenefitEnrollments() {
  const [enrollments, setEnrollments] = useState<EmployeeBenefit[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending_approval');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      let endpoint = '/benefits/enrollments';

      if (statusFilter === 'pending_approval') {
        endpoint = '/benefits/enrollments/pending/approvals';
      }

      const [enrollmentsRes] = await Promise.all([
        api.get(endpoint),
      ]);

      setEnrollments(enrollmentsRes.data || []);

      // Calculate statistics
      const active = enrollmentsRes.data.filter((e: EmployeeBenefit) => e.status === 'active').length;
      const pending = enrollmentsRes.data.filter((e: EmployeeBenefit) => e.status === 'pending_approval').length;
      const pendingDocs = enrollmentsRes.data.filter((e: EmployeeBenefit) => e.status === 'pending_documents').length;
      const monthlyCost = enrollmentsRes.data
        .filter((e: EmployeeBenefit) => e.status === 'active')
        .reduce((sum: number, e: EmployeeBenefit) => sum + e.total_contribution, 0);

      setStatistics({
        total_enrollments: enrollmentsRes.data.length,
        active_enrollments: active,
        pending_approvals: pending,
        pending_documents: pendingDocs,
        total_monthly_cost: monthlyCost,
      });
    } catch (error) {
      console.error('Failed to load benefit enrollments', error);
      setEnrollments([]);
      setStatistics({
        total_enrollments: 0,
        active_enrollments: 0,
        pending_approvals: 0,
        pending_documents: 0,
        total_monthly_cost: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (enrollmentId: string) => {
    if (!window.confirm('Are you sure you want to approve this enrollment?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/benefits/enrollments/${enrollmentId}/approve`);
      await loadData();
      alert('Enrollment approved successfully');
    } catch (error: any) {
      console.error('Failed to approve enrollment', error);
      alert(error.response?.data?.error || 'Failed to approve enrollment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (enrollmentId: string) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.post(`/benefits/enrollments/${enrollmentId}/reject`, { reason });
      await loadData();
      alert('Enrollment rejected successfully');
    } catch (error: any) {
      console.error('Failed to reject enrollment', error);
      alert(error.response?.data?.error || 'Failed to reject enrollment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDocuments = async (enrollmentId: string) => {
    if (!window.confirm('Confirm that all documents have been verified?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/benefits/enrollments/${enrollmentId}/verify-documents`);
      await loadData();
      alert('Documents verified successfully');
    } catch (error: any) {
      console.error('Failed to verify documents', error);
      alert(error.response?.data?.error || 'Failed to verify documents');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (enrollmentId: string) => {
    const memberNumber = window.prompt('Enter provider member number (optional):');

    setActionLoading(true);
    try {
      await api.post(`/benefits/enrollments/${enrollmentId}/activate`, {
        member_number: memberNumber || undefined,
      });
      await loadData();
      alert('Enrollment activated successfully');
    } catch (error: any) {
      console.error('Failed to activate enrollment', error);
      alert(error.response?.data?.error || 'Failed to activate enrollment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending_documents':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'suspended':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'pending_approval':
      case 'pending_documents':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
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
        <div className="text-gray-500">Loading enrollments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benefit Enrollments</h1>
          <p className="text-gray-600 mt-1">Manage and approve employee benefit enrollments</p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Enrollments</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.total_enrollments}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.active_enrollments}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.pending_approvals}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Documents</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.pending_documents}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FileCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_monthly_cost)}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="pending_documents">Pending Documents</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Enrollments List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Benefit Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employer
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <UserCheck className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p>No enrollments found</p>
                    <p className="text-sm mt-1">No enrollments match the selected filters</p>
                  </td>
                </tr>
              ) : (
                enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <Link
                          to={`/admin/benefits/enrollments/${enrollment.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {enrollment.first_name} {enrollment.last_name}
                        </Link>
                        <span className="text-xs text-gray-500">{enrollment.employee_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{enrollment.plan_name}</span>
                        <span className="text-xs text-gray-500">{enrollment.provider_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          enrollment.status
                        )}`}
                      >
                        {getStatusIcon(enrollment.status)}
                        <span className="capitalize">{enrollment.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(enrollment.effective_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(enrollment.employee_contribution)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(enrollment.employer_contribution)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(enrollment.total_contribution)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/admin/benefits/enrollments/${enrollment.id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>

                        {enrollment.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => handleApprove(enrollment.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Approve"
                              disabled={actionLoading}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(enrollment.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Reject"
                              disabled={actionLoading}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {enrollment.status === 'pending_documents' && (
                          <>
                            {!enrollment.documents_verified && (
                              <button
                                onClick={() => handleVerifyDocuments(enrollment.id)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Verify Documents"
                                disabled={actionLoading}
                              >
                                <FileCheck className="w-5 h-5" />
                              </button>
                            )}
                            {enrollment.documents_verified && (
                              <button
                                onClick={() => handleActivate(enrollment.id)}
                                className="text-green-600 hover:text-green-700"
                                title="Activate"
                                disabled={actionLoading}
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
