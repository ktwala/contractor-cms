'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { api } from '@/lib/api';
import {
  DollarSign,
  Users,
  FolderKanban,
  Clock,
  Receipt,
  TrendingUp,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardData {
  financial: {
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    invoiceCount: number;
    averageInvoiceAmount: number;
  };
  contractors: {
    totalContractors: number;
    activeContractors: number;
    inactiveContractors: number;
    activeEngagements: number;
    supplierCount: number;
  };
  projects: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalBudget: number;
    totalUtilized: number;
    averageUtilization: number;
  };
  timesheets: {
    totalTimesheets: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    totalHours: number;
  };
  tax: {
    totalWithheld: number;
    payeWithheld: number;
    sdlWithheld: number;
    uifWithheld: number;
    instructionCount: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await api.getDashboardAnalytics();
      setData(response);
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `R${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `R${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  // Prepare chart data
  const getFinancialChartData = () => {
    if (!data) return [];
    return [
      { name: 'Invoiced', amount: data.financial.totalInvoiced },
      { name: 'Paid', amount: data.financial.totalPaid },
      { name: 'Pending', amount: data.financial.totalPending },
    ];
  };

  const getTimesheetChartData = () => {
    if (!data) return [];
    return [
      { name: 'Approved', value: data.timesheets.approved, color: '#10b981' },
      { name: 'Pending', value: data.timesheets.pendingApproval, color: '#f59e0b' },
      { name: 'Rejected', value: data.timesheets.rejected, color: '#ef4444' },
    ];
  };

  const getProjectStatusData = () => {
    if (!data) return [];
    return [
      { name: 'Active', value: data.projects.activeProjects, color: '#3b82f6' },
      { name: 'Completed', value: data.projects.completedProjects, color: '#10b981' },
    ];
  };

  const getTaxBreakdownData = () => {
    if (!data) return [];
    return [
      { name: 'PAYE', amount: data.tax.payeWithheld },
      { name: 'SDL', amount: data.tax.sdlWithheld },
      { name: 'UIF', amount: data.tax.uifWithheld },
    ];
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || 'Failed to load dashboard'}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your contractor management system</p>
        </div>

        {/* Financial Summary */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoiced</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(data.financial.totalInvoiced)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Paid</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(data.financial.totalPaid)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {formatCurrency(data.financial.totalPending)}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Invoice Count</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {data.financial.invoiceCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {formatCurrency(data.financial.averageInvoiceAmount)}
                  </p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Financial & Timesheets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Overview Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Financial Overview</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getFinancialChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={formatCompactCurrency} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                  }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Timesheet Status Distribution */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timesheet Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getTimesheetChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getTimesheetChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2: Projects & Tax */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Status */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getProjectStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getProjectStatusData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Budget</span>
                <span className="font-semibold">{formatCurrency(data.projects.totalBudget)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Utilized</span>
                <span className="font-semibold text-primary-600">
                  {formatCurrency(data.projects.totalUtilized)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Avg Utilization</span>
                <span className="font-bold text-primary-700">
                  {data.projects.averageUtilization.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Tax Withholding Breakdown */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Withholding Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getTaxBreakdownData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={formatCompactCurrency} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                  }}
                />
                <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total Withheld</span>
              <span className="text-lg font-bold text-purple-600">
                {formatCurrency(data.tax.totalWithheld)}
              </span>
            </div>
          </div>
        </div>

        {/* Contractors & Timesheets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contractors Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contractors</h2>
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Contractors</span>
                </div>
                <span className="text-lg font-bold">{data.contractors.totalContractors}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Active</span>
                <span className="text-sm font-semibold text-green-600">
                  {data.contractors.activeContractors}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Inactive</span>
                <span className="text-sm font-semibold text-gray-500">
                  {data.contractors.inactiveContractors}
                </span>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Engagements</span>
                <span className="text-lg font-bold text-primary-600">
                  {data.contractors.activeEngagements}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Suppliers</span>
                <span className="text-sm font-semibold">{data.contractors.supplierCount}</span>
              </div>
            </div>
          </div>

          {/* Timesheets Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timesheets</h2>
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Timesheets</span>
                </div>
                <span className="text-lg font-bold">{data.timesheets.totalTimesheets}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Pending Approval</span>
                <span className="text-sm font-semibold text-yellow-600">
                  {data.timesheets.pendingApproval}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Approved</span>
                <span className="text-sm font-semibold text-green-600">
                  {data.timesheets.approved}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Rejected</span>
                <span className="text-sm font-semibold text-red-600">
                  {data.timesheets.rejected}
                </span>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Hours</span>
                <span className="text-lg font-bold text-primary-600">
                  {data.timesheets.totalHours.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
