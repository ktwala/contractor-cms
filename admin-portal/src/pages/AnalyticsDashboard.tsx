import { useState, useEffect } from 'react';
import api from '../services/api';

interface DashboardMetrics {
  employees: {
    total_employees: number;
    active_employees: number;
    inactive_employees: number;
    terminated_employees: number;
  };
  payroll: {
    total_payruns: number;
    total_gross_pay: number;
    total_net_pay: number;
    total_deductions: number;
    total_employer_costs: number;
  };
  leave: {
    total_leave_requests: number;
    approved_days: number;
    pending_requests: number;
  };
  expenses: {
    total_claims: number;
    approved_amount: number;
    pending_amount: number;
    pending_claims: number;
  };
  loans: {
    total_active_loans: number;
    total_principal: number;
    total_outstanding: number;
    total_monthly_deductions: number;
  };
  performance: {
    total_reviews: number;
    average_rating: number;
    completed_reviews: number;
  };
}

interface PayrollTrend {
  period: string;
  payrun_count: number;
  employee_count: number;
  total_gross: number;
  total_net: number;
  total_deductions: number;
  avg_gross_pay: number;
}

interface DepartmentData {
  department: string;
  employee_count: number;
  avg_salary: number;
  total_cost: number;
  total_employer_costs: number;
}

interface KPI {
  id: string;
  kpi_name: string;
  kpi_type: string;
  current_value: number;
  previous_value: number;
  target_value: number;
  unit: string;
}

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<PayrollTrend[]>([]);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('ZAF');
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  useEffect(() => {
    loadDashboardData();
  }, [selectedCountry, selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, trendsRes, deptRes, kpisRes] = await Promise.all([
        api.get(`/analytics/dashboard?country=${selectedCountry}`),
        api.get(`/analytics/payroll/trends?country=${selectedCountry}&period=${selectedPeriod}&limit=12`),
        api.get(`/analytics/departments?country=${selectedCountry}`),
        api.get('/analytics/kpis'),
      ]);

      setMetrics(metricsRes.data);
      setTrends(trendsRes.data);
      setDepartments(deptRes.data);
      setKpis(kpisRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount || 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-ZA').format(num || 0);
  };

  const calculateChange = (current: number, previous: number): string => {
    if (!previous) return '0';
    return ((current - previous) / previous * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive payroll and HR analytics</p>
        </div>
        <div className="flex gap-4">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ZAF">South Africa</option>
            <option value="LSO">Lesotho</option>
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.slice(0, 4).map((kpi) => {
          const change = calculateChange(kpi.current_value, kpi.previous_value);
          const isPositive = parseFloat(change) >= 0;

          return (
            <div key={kpi.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">{kpi.kpi_name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {kpi.unit === 'ZAR' ? formatCurrency(kpi.current_value) : formatNumber(kpi.current_value)}
                    {kpi.unit === '%' && '%'}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isPositive ? '+' : ''}{change}%
                </div>
              </div>
              {kpi.target_value > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Target: {formatNumber(kpi.target_value)}</span>
                    <span>{((kpi.current_value / kpi.target_value) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min((kpi.current_value / kpi.target_value) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Employee Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Employees</span>
              <span className="font-semibold">{metrics?.employees.total_employees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{metrics?.employees.active_employees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Inactive</span>
              <span className="font-semibold text-yellow-600">{metrics?.employees.inactive_employees || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Terminated</span>
              <span className="font-semibold text-red-600">{metrics?.employees.terminated_employees || 0}</span>
            </div>
          </div>
        </div>

        {/* Payroll Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary (Last 3 Months)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Payruns</span>
              <span className="font-semibold">{metrics?.payroll.total_payruns || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gross Pay</span>
              <span className="font-semibold">{formatCurrency(metrics?.payroll.total_gross_pay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Net Pay</span>
              <span className="font-semibold text-green-600">{formatCurrency(metrics?.payroll.total_net_pay || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Deductions</span>
              <span className="font-semibold text-orange-600">{formatCurrency(metrics?.payroll.total_deductions || 0)}</span>
            </div>
          </div>
        </div>

        {/* Leave Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Overview (Last 3 Months)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Requests</span>
              <span className="font-semibold">{metrics?.leave.total_leave_requests || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Approved Days</span>
              <span className="font-semibold text-green-600">{metrics?.leave.approved_days || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">{metrics?.leave.pending_requests || 0}</span>
            </div>
          </div>
        </div>

        {/* Expense Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Claims (Last 3 Months)</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Claims</span>
              <span className="font-semibold">{metrics?.expenses.total_claims || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Approved</span>
              <span className="font-semibold text-green-600">{formatCurrency(metrics?.expenses.approved_amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">{formatCurrency(metrics?.expenses.pending_amount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Loan Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Loans</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Loans</span>
              <span className="font-semibold">{metrics?.loans.total_active_loans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Principal</span>
              <span className="font-semibold">{formatCurrency(metrics?.loans.total_principal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outstanding</span>
              <span className="font-semibold text-orange-600">{formatCurrency(metrics?.loans.total_outstanding || 0)}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Reviews</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Reviews</span>
              <span className="font-semibold">{metrics?.performance.total_reviews || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{metrics?.performance.completed_reviews || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Rating</span>
              <span className="font-semibold text-blue-600">
                {(metrics?.performance.average_rating || 0).toFixed(1)} / 5.0
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Trends Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Trends</h3>
        <div className="space-y-2">
          {trends.map((trend, index) => (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600">{trend.period}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs font-medium"
                      style={{ width: `${(trend.total_gross / Math.max(...trends.map(t => t.total_gross)) * 100)}%` }}
                    >
                      {formatCurrency(trend.total_gross)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 w-20">{trend.employee_count} emp</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Department Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Cost Analysis</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employees
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Salary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departments.map((dept, index) => {
                const totalCost = departments.reduce((sum, d) => sum + d.total_cost, 0);
                const percentage = (dept.total_cost / totalCost * 100).toFixed(1);

                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dept.department || 'Not Assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dept.employee_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(dept.avg_salary)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {formatCurrency(dept.total_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        {percentage}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={loadDashboardData}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Print Dashboard
        </button>
      </div>
    </div>
  );
}
