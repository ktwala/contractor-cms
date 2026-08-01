import { useEffect, useState } from 'react';
import {
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  FileText,
  Eye,
  X as XIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';

interface LoanApplication {
  id: string;
  application_number: string;
  loan_type_name: string;
  requested_amount: number;
  approved_amount?: number;
  tenure_months: number;
  interest_rate: number;
  monthly_deduction?: number;
  total_repayment?: number;
  status: string;
  application_date: string;
  submission_date?: string;
  approval_date?: string;
  rejection_reason?: string;
}

interface ActiveLoan {
  id: string;
  loan_number: string;
  loan_type_name: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  monthly_deduction: number;
  total_repayment: number;
  total_paid: number;
  outstanding_balance: number;
  disbursement_date: string;
  expected_completion_date: string;
  status: string;
}

interface LoanSchedule {
  id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
}

export default function MyLoans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applications' | 'active'>('applications');
  const [currency] = useState('ZAR');

  // Data
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [schedule, setSchedule] = useState<LoanSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Statistics
  const [appStats, setAppStats] = useState<any>(null);
  const [loanStats, setLoanStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [appsRes, loansRes, appStatsRes, loanStatsRes] = await Promise.all([
        api.get('/loans/applications?employee_id=current'),
        api.get('/loans/active?employee_id=current'),
        api.get('/loans/stats/applications?employee_id=current'),
        api.get('/loans/stats/loans?employee_id=current'),
      ]);

      setApplications(appsRes.data || []);
      setActiveLoans(loansRes.data || []);
      setAppStats(appStatsRes.data);
      setLoanStats(loanStatsRes.data);
    } catch (error) {
      console.error('Failed to load loan data', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (loanId: string) => {
    try {
      const response = await api.get(`/loans/active/${loanId}/schedule`);
      setSchedule(response.data || []);
    } catch (error) {
      console.error('Failed to load loan schedule', error);
      alert('Failed to load repayment schedule');
    }
  };

  const handleViewSchedule = async (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    await loadSchedule(loan.id);
    setShowScheduleModal(true);
  };

  const formatCurrency = (value: number) => {
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
      active: { color: 'bg-green-100 text-green-800', icon: TrendingUp, label: 'Active' },
      completed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Completed' },
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

  const getScheduleStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending' },
      paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
      partial: { color: 'bg-yellow-100 text-yellow-800', label: 'Partial' },
      missed: { color: 'bg-red-100 text-red-800', label: 'Missed' },
    };

    const badge = badges[status] || badges.pending;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your loans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Loans</h1>
          <p className="text-gray-600 mt-1">View and manage your loan applications and active loans</p>
        </div>
        <button
          onClick={() => navigate('/loans/apply')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Apply for Loan
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Applications</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {appStats?.total_applications || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Loans</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loanStats?.active_loans || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outstanding Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(loanStats?.total_outstanding || 0)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(loanStats?.total_collected || 0)}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'applications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Applications</span>
                <span className="ml-2 bg-gray-100 text-gray-800 py-0.5 px-2 rounded-full text-xs">
                  {applications.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>Active Loans</span>
                <span className="ml-2 bg-gray-100 text-gray-800 py-0.5 px-2 rounded-full text-xs">
                  {activeLoans.length}
                </span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'applications' ? (
            applications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No loan applications yet</p>
                <button
                  onClick={() => navigate('/loans/apply')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Apply for Loan
                </button>
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {app.application_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {app.loan_type_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(app.requested_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                          {app.tenure_months} months
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(app.application_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(app.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeLoans.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No active loans</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{loan.loan_number}</h3>
                      <p className="text-sm text-gray-600">{loan.loan_type_name}</p>
                    </div>
                    {getStatusBadge(loan.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600">Principal Amount</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(loan.principal_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Monthly Deduction</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(loan.monthly_deduction)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Paid</p>
                      <p className="text-sm font-medium text-green-600">
                        {formatCurrency(loan.total_paid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Outstanding</p>
                      <p className="text-sm font-medium text-yellow-600">
                        {formatCurrency(loan.outstanding_balance)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Repayment Progress</span>
                      <span>
                        {((loan.total_paid / loan.total_repayment) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${(loan.total_paid / loan.total_repayment) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>
                        Started: {format(new Date(loan.disbursement_date), 'dd MMM yyyy')}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        Ends: {format(new Date(loan.expected_completion_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewSchedule(loan)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Schedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
                <p className="text-sm text-gray-600">{selectedLoan.loan_number}</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Principal
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Interest
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedule.map((item) => (
                      <tr
                        key={item.id}
                        className={item.status === 'paid' ? 'bg-green-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.installment_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(item.due_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(item.principal_amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(item.interest_amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(item.total_amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {getScheduleStatusBadge(item.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
