import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  CheckCircle,
  Calendar,
  Eye,
  X as XIcon,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface ActiveLoan {
  id: string;
  loan_number: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  loan_type_name: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  monthly_deduction: number;
  total_repayment: number;
  total_paid: number;
  principal_paid: number;
  interest_paid: number;
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

interface Statistics {
  total_loans: number;
  active_loans: number;
  completed_loans: number;
  total_disbursed: number;
  total_outstanding: number;
  total_collected: number;
}

export default function ActiveLoans() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [schedule, setSchedule] = useState<LoanSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [loansRes, statsRes] = await Promise.all([
        api.get(`/loans/active${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/loans/stats/loans'),
      ]);

      setLoans(loansRes.data || []);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Failed to load active loans', error);
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

  const formatCurrency = (value: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      completed: { color: 'bg-blue-100 text-blue-800', label: 'Completed' },
      defaulted: { color: 'bg-red-100 text-red-800', label: 'Defaulted' },
      written_off: { color: 'bg-gray-100 text-gray-800', label: 'Written Off' },
      early_settled: { color: 'bg-purple-100 text-purple-800', label: 'Early Settled' },
    };

    const badge = badges[status] || badges.active;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
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
        <div className="text-gray-500">Loading active loans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Active Loans</h1>
        <p className="text-gray-600 mt-1">Monitor and manage active employee loans</p>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Loans</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.active_loans}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Disbursed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_disbursed || 0)}
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
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_outstanding || 0)}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Collected</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_collected || 0)}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-purple-600" />
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
            <option value="">All Loans</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loans.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No loans found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
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
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {loan.loan_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{loan.employee_name}</span>
                        <span className="text-xs text-gray-500">{loan.employee_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {loan.loan_type_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(loan.principal_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {formatCurrency(loan.total_paid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-medium">
                      {formatCurrency(loan.outstanding_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <div className="w-24">
                          <div className="text-xs text-center text-gray-600 mb-1">
                            {((loan.total_paid / loan.total_repayment) * 100).toFixed(0)}%
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
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(loan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewSchedule(loan)}
                        className="text-blue-600 hover:text-blue-700"
                        title="View Schedule"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
                <p className="text-sm text-gray-600">
                  {selectedLoan.loan_number} - {selectedLoan.employee_name}
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Loan Summary */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Principal Amount</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(selectedLoan.principal_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Monthly Deduction</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(selectedLoan.monthly_deduction)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total Paid</p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(selectedLoan.total_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Outstanding Balance</p>
                  <p className="font-medium text-yellow-600">
                    {formatCurrency(selectedLoan.outstanding_balance)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-240px)]">
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Paid
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                          {formatCurrency(item.paid_amount)}
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
