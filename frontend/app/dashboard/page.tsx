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
  AlertCircle
} from 'lucide-react';

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

        {/* Contractors & Projects Row */}
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

          {/* Projects Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects</h2>
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FolderKanban className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Projects</span>
                </div>
                <span className="text-lg font-bold">{data.projects.totalProjects}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Active</span>
                <span className="text-sm font-semibold text-green-600">
                  {data.projects.activeProjects}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">Completed</span>
                <span className="text-sm font-semibold text-gray-500">
                  {data.projects.completedProjects}
                </span>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(data.projects.totalBudget)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Utilized</span>
                  <span className="text-sm font-semibold text-primary-600">
                    {formatCurrency(data.projects.totalUtilized)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg Utilization</span>
                  <span className="text-sm font-bold text-primary-700">
                    {data.projects.averageUtilization.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timesheets & Tax Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* Tax Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Withholding</h2>
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Withheld</span>
                </div>
                <span className="text-lg font-bold">{formatCurrency(data.tax.totalWithheld)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">PAYE</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(data.tax.payeWithheld)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">SDL</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(data.tax.sdlWithheld)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 ml-7">UIF</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(data.tax.uifWithheld)}
                </span>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Instructions</span>
                <span className="text-lg font-bold text-primary-600">
                  {data.tax.instructionCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
