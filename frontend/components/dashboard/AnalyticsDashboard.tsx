'use client';

import { useEffect, useState } from 'react';
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
// InvoiceTrendsWidget removed — not yet implemented
import { ContractRenewalsWidget } from './ContractRenewalsWidget';
import { PdpShadowTelemetryWidget } from './PdpShadowTelemetryWidget';
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

export default function AnalyticsDashboard() {
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
    return `R${amount}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // Chart Data Preparation
  const invoiceStatusData = [
    { name: 'Paid', value: data.financial.totalPaid, color: '#10B981' },
    { name: 'Pending', value: data.financial.totalPending, color: '#F59E0B' },
  ];

  const timesheetStatusData = [
    { name: 'Approved', value: data.timesheets.approved, color: '#10B981' },
    { name: 'Pending', value: data.timesheets.pendingApproval, color: '#F59E0B' },
    { name: 'Rejected', value: data.timesheets.rejected, color: '#EF4444' },
  ];

  const taxBreakdownData = [
    { name: 'PAYE', value: data.tax.payeWithheld, color: '#3B82F6' },
    { name: 'SDL', value: data.tax.sdlWithheld, color: '#8B5CF6' },
    { name: 'UIF', value: data.tax.uifWithheld, color: '#EC4899' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Invoiced (YTD)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(data.financial.totalInvoiced)}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5%
            </span>
            <span className="text-gray-500 ml-2">vs last year</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Contractors</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.contractors.activeContractors}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            Across {data.contractors.supplierCount} suppliers
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Timesheets</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.timesheets.pendingApproval}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-amber-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            Requires attention
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Projects</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {data.projects.activeProjects}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <FolderKanban className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            {formatCompactCurrency(data.projects.totalBudget)} total budget
          </div>
        </div>
      </div>

      {/* Renewals Widget */}
      <ContractRenewalsWidget />
      
      {/* PDP Telemetry Widget */}
      <PdpShadowTelemetryWidget />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-gray-400" />
            Invoice Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invoiceStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {invoiceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-400" />
            Timesheet Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timesheetStatusData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {timesheetStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Financial Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-gray-400" />
            Project Utilization
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-sm text-gray-500">Overall Budget Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.projects.averageUtilization.toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Utilized</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatCurrency(data.projects.totalUtilized)}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full" 
                style={{ width: `${Math.min(data.projects.averageUtilization, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-gray-400" />
            Tax Withholding
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taxBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {taxBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <p className="text-sm text-gray-500">Total Withheld</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(data.tax.totalWithheld)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
