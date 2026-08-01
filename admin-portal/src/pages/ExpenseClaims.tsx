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
  DollarSign,
  TrendingUp,
  FileText,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface ExpenseClaim {
  id: string;
  claim_number: string;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  employee_number?: string;
  claim_date: string;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: number;
  approved_amount?: number;
  currency: string;
  created_at: string;
}

interface Statistics {
  total_claims: number;
  pending_approval: number;
  approved: number;
  paid: number;
  total_approved_amount: number;
  total_paid_amount: number;
}

export default function ExpenseClaims() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending_approval');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      let endpoint = '/expenses/claims';

      if (statusFilter === 'pending_approval') {
        endpoint = '/expenses/claims/pending/approvals';
      } else if (statusFilter !== 'all') {
        endpoint = `/expenses/claims?status=${statusFilter}`;
      }

      const [claimsRes, statsRes] = await Promise.all([
        api.get(endpoint),
        api.get('/expenses/stats/summary'),
      ]);

      setClaims(claimsRes.data || []);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Failed to load expense claims', error);
      setClaims([]);
      setStatistics({
        total_claims: 0,
        pending_approval: 0,
        approved: 0,
        paid: 0,
        total_approved_amount: 0,
        total_paid_amount: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (claimId: string) => {
    if (!window.confirm('Are you sure you want to approve this expense claim?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/expenses/claims/${claimId}/approve`, {});
      await loadData();
      alert('Expense claim approved successfully');
    } catch (error: any) {
      console.error('Failed to approve claim', error);
      alert(error.response?.data?.error || 'Failed to approve claim');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (claimId: string) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.post(`/expenses/claims/${claimId}/reject`, { reason });
      await loadData();
      alert('Expense claim rejected successfully');
    } catch (error: any) {
      console.error('Failed to reject claim', error);
      alert(error.response?.data?.error || 'Failed to reject claim');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'pending_approval':
      case 'submitted':
        return <Clock className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading expense claims...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expense Claims</h1>
          <p className="text-gray-600 mt-1">Manage and approve employee expense claims</p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Claims</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.total_claims}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.pending_approval}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
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
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paid Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_paid_amount)}
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
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Claims List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p>No expense claims found</p>
                    <p className="text-sm mt-1">No claims match the selected filters</p>
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/admin/expenses/${claim.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {claim.claim_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {claim.first_name} {claim.last_name}
                        </span>
                        <span className="text-xs text-gray-500">{claim.employee_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          claim.status
                        )}`}
                      >
                        {getStatusIcon(claim.status)}
                        <span className="capitalize">{claim.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(claim.period_start), 'dd MMM')} -{' '}
                      {format(new Date(claim.period_end), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(claim.total_amount, claim.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/admin/expenses/${claim.id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>

                        {claim.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => handleApprove(claim.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Approve"
                              disabled={actionLoading}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(claim.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Reject"
                              disabled={actionLoading}
                            >
                              <X className="w-5 h-5" />
                            </button>
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
