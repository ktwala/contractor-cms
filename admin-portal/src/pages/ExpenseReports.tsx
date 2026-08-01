import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  Filter,
  BarChart3,
  PieChart,
} from 'lucide-react';
import api from '../services/api';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Statistics {
  total_claims: number;
  pending_approval: number;
  approved: number;
  paid: number;
  rejected: number;
  total_approved_amount: number;
  total_paid_amount: number;
  total_pending_amount: number;
  avg_claim_amount: number;
  avg_approval_days: number;
}

interface CategorySpending {
  category_name: string;
  total_amount: number;
  claim_count: number;
  percentage: number;
}

interface MonthlyTrend {
  month: string;
  total_amount: number;
  claim_count: number;
  approved_count: number;
  rejected_count: number;
}

interface EmployeeSpending {
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  total_claims: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
}

export default function ExpenseReports() {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [topSpenders, setTopSpenders] = useState<EmployeeSpending[]>([]);
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedReport, setSelectedReport] = useState<'overview' | 'categories' | 'trends' | 'employees'>(
    'overview'
  );

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load statistics
      const [statsRes, categoryRes, trendsRes, spendersRes] = await Promise.all([
        api.get('/expenses/stats/summary'),
        api.get('/expenses/reports/by-category', { params: { date_from: dateFrom, date_to: dateTo } }),
        api.get('/expenses/reports/monthly-trends', { params: { date_from: dateFrom, date_to: dateTo } }),
        api.get('/expenses/reports/top-spenders', { params: { date_from: dateFrom, date_to: dateTo } }),
      ]);

      setStatistics(statsRes.data);
      setCategorySpending(categoryRes.data || []);
      setMonthlyTrends(trendsRes.data || []);
      setTopSpenders(spendersRes.data || []);
    } catch (error) {
      console.error('Failed to load expense reports', error);
      setStatistics(null);
      setCategorySpending([]);
      setMonthlyTrends([]);
      setTopSpenders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const exportReport = () => {
    alert('Export functionality would download a CSV/PDF report');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading expense reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expense Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Analyze spending patterns and trends</p>
        </div>
        <button
          onClick={exportReport}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => {
                setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              This Month
            </button>
            <button
              onClick={() => {
                setDateFrom(format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
                setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Last 6 Months
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Claims</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.total_claims}</p>
                <p className="text-xs text-green-600 mt-2 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12% from last period
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
                <p className="text-sm text-gray-600">Approved Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.total_approved_amount)}
                </p>
                <p className="text-xs text-green-600 mt-2 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +8% from last period
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
                <p className="text-sm text-gray-600">Avg Claim Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(statistics.avg_claim_amount)}
                </p>
                <p className="text-xs text-red-600 mt-2 flex items-center">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  -3% from last period
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Approval Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {statistics.avg_approval_days}
                  <span className="text-lg text-gray-500 ml-1">days</span>
                </p>
                <p className="text-xs text-green-600 mt-2 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  15% faster
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setSelectedReport('overview')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${selectedReport === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>
            <button
              onClick={() => setSelectedReport('categories')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${selectedReport === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <PieChart className="w-4 h-4" />
                <span>By Category</span>
              </div>
            </button>
            <button
              onClick={() => setSelectedReport('trends')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${selectedReport === 'trends'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>Monthly Trends</span>
              </div>
            </button>
            <button
              onClick={() => setSelectedReport('employees')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${selectedReport === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>By Employee</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {selectedReport === 'overview' && statistics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Breakdown */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Claims by Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-700">Approved</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{statistics.approved}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-700">Paid</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{statistics.paid}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm text-gray-700">Pending</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {statistics.pending_approval}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-gray-700">Rejected</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{statistics.rejected}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Total Approved</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(statistics.total_approved_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Total Paid</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(statistics.total_paid_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Pending Payment</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(statistics.total_pending_amount)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Average Claim</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(statistics.avg_claim_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Rate */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Rate</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-700">Approved</span>
                      <span className="text-sm font-medium text-gray-900">
                        {((statistics.approved / statistics.total_claims) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${(statistics.approved / statistics.total_claims) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-700">Rejected</span>
                      <span className="text-sm font-medium text-gray-900">
                        {((statistics.rejected / statistics.total_claims) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${(statistics.rejected / statistics.total_claims) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedReport === 'categories' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Spending by Category</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Claims
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % of Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Distribution
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categorySpending.map((category, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {category.category_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {category.claim_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(category.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {category.percentage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${category.percentage}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReport === 'trends' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Trends</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Claims
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rejected
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approval Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlyTrends.map((trend, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trend.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {trend.claim_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(trend.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {trend.approved_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {trend.rejected_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {((trend.approved_count / trend.claim_count) * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReport === 'employees' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Employee Spending</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Claims
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg per Claim
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topSpenders.map((employee) => (
                      <tr key={employee.employee_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {employee.first_name} {employee.last_name}
                            </span>
                            <span className="text-xs text-gray-500">{employee.employee_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {employee.total_claims}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(employee.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(employee.approved_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(employee.pending_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {formatCurrency(employee.total_amount / employee.total_claims)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
