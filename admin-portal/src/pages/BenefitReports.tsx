import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  Download,
  Calendar,
  PieChart,
  BarChart3,
} from 'lucide-react';
import api from '../services/api';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface DeductionSummary {
  total_deductions: number;
  total_employer_contributions: number;
  total_amount: number;
  by_plan: Array<{
    plan_id: string;
    plan_name: string;
    employee_count: number;
    total_employee: number;
    total_employer: number;
    total: number;
  }>;
}

interface EnrollmentStats {
  total: number;
  by_status: Record<string, number>;
  by_plan: Record<string, number>;
}

export default function BenefitReports() {
  const [deductionSummary, setDeductionSummary] = useState<DeductionSummary | null>(null);
  const [enrollmentStats, setEnrollmentStats] = useState<EnrollmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    loadData();
  }, [periodStart, periodEnd]);

  const loadData = async () => {
    try {
      const [summaryRes, statsRes] = await Promise.all([
        api.get('/benefits/reports/deduction-summary', {
          params: { period_start: periodStart, period_end: periodEnd },
        }),
        api.get('/benefits/stats/enrollments'),
      ]);

      setDeductionSummary(summaryRes.data);
      setEnrollmentStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load benefit reports', error);
      setDeductionSummary(null);
      setEnrollmentStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const setQuickPeriod = (months: number) => {
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(end, months - 1));
    setPeriodStart(format(start, 'yyyy-MM-dd'));
    setPeriodEnd(format(end, 'yyyy-MM-dd'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benefits Reports</h1>
          <p className="text-gray-600 mt-1">View benefit costs, enrollments, and analytics</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <Download className="w-5 h-5 mr-2" />
          Export Report
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Reporting Period:</span>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-2 ml-auto">
            <button
              onClick={() => setQuickPeriod(1)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickPeriod(3)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              3 Months
            </button>
            <button
              onClick={() => setQuickPeriod(12)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              12 Months
            </button>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {deductionSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Employee Contributions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(deductionSummary.total_deductions)}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Employer Contributions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(deductionSummary.total_employer_contributions)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Benefits Cost</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(deductionSummary.total_amount)}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Summary by Plan */}
      {deductionSummary && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <BarChart3 className="w-5 h-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Deductions by Benefit Plan</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Benefit Plan
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Contributions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employer Contributions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deductionSummary.by_plan.map((plan) => (
                  <tr key={plan.plan_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {plan.plan_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {plan.employee_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(plan.total_employee)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(plan.total_employer)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(plan.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      {((plan.total / deductionSummary.total_amount) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {deductionSummary.by_plan.reduce((sum, p) => sum + p.employee_count, 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(deductionSummary.total_deductions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(deductionSummary.total_employer_contributions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(deductionSummary.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    100.0%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enrollment Statistics */}
      {enrollmentStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <PieChart className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Enrollments by Status</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {Object.entries(enrollmentStats.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm text-gray-700 capitalize">
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                      <span className="text-sm text-gray-500 w-12 text-right">
                        {((count / enrollmentStats.total) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Top Benefit Plans</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {Object.entries(enrollmentStats.by_plan)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{plan}</span>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(count / enrollmentStats.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
