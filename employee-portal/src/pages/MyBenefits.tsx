import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Wallet,
  Shield,
  Users,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface BenefitEnrollment {
  id: string;
  plan_id: string;
  plan_name: string;
  benefit_type: string;
  provider_name?: string;
  status: string;
  effective_date: string;
  end_date?: string;
  employee_contribution: number;
  employer_contribution: number;
  total_contribution: number;
  member_number?: string;
  dependent_count?: number;
}

interface YTDContributions {
  total_employee: number;
  total_employer: number;
  total: number;
  by_plan: Array<{
    plan_name: string;
    employee_contribution: number;
    employer_contribution: number;
    total: number;
  }>;
}

export default function MyBenefits() {
  const [enrollments, setEnrollments] = useState<BenefitEnrollment[]>([]);
  const [ytdContributions, setYtdContributions] = useState<YTDContributions | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');

  useEffect(() => {
    loadBenefits();
  }, []);

  const loadBenefits = async () => {
    try {
      const year = new Date().getFullYear();

      const [enrollmentsRes, ytdRes] = await Promise.all([
        api.get('/benefits/employees/current/enrollments'),
        api.get(`/benefits/employees/current/ytd-contributions?year=${year}`),
      ]);

      setEnrollments(enrollmentsRes.data || []);
      setYtdContributions(ytdRes.data);
    } catch (error) {
      console.error('Failed to load benefits:', error);
      setEnrollments([]);
      setYtdContributions(null);
    } finally {
      setLoading(false);
    }
  };

  const getBenefitTypeIcon = (type: string) => {
    switch (type) {
      case 'medical_aid':
      case 'gap_cover':
        return <Heart className="w-5 h-5" />;
      case 'pension_fund':
      case 'provident_fund':
      case 'retirement_annuity':
        return <Wallet className="w-5 h-5" />;
      case 'uif':
      case 'sdl':
      case 'workmen_compensation':
        return <Shield className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getBenefitTypeColor = (type: string) => {
    switch (type) {
      case 'medical_aid':
      case 'gap_cover':
        return 'bg-red-100 text-red-700';
      case 'pension_fund':
      case 'provident_fund':
        return 'bg-blue-100 text-blue-700';
      case 'uif':
      case 'sdl':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending_approval':
      case 'pending_documents':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
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

  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const displayEnrollments = activeTab === 'active' ? activeEnrollments : enrollments;

  const totalMonthlyContribution = activeEnrollments.reduce(
    (sum, e) => sum + e.employee_contribution,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your benefits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Benefits</h1>
          <p className="text-gray-600 mt-1">View and manage your employee benefits</p>
        </div>
        <Link
          to="/benefits/enroll"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Enroll in Benefit
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Benefits</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{activeEnrollments.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Contribution</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalMonthlyContribution)}
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
              <p className="text-sm text-gray-600">YTD Contributions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {ytdContributions ? formatCurrency(ytdContributions.total_employee) : '-'}
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
              <p className="text-sm text-gray-600">Covered Dependents</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {activeEnrollments.reduce((sum, e) => sum + (e.dependent_count || 0), 0)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Active Benefits ({activeEnrollments.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              All Benefits ({enrollments.length})
            </button>
          </nav>
        </div>

        {/* Benefits List */}
        <div className="p-6">
          {displayEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No benefits found</p>
              <p className="text-sm text-gray-400 mt-1">Enroll in a benefit plan to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-lg ${getBenefitTypeColor(enrollment.benefit_type)}`}
                      >
                        {getBenefitTypeIcon(enrollment.benefit_type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{enrollment.plan_name}</h3>
                        {enrollment.provider_name && (
                          <p className="text-sm text-gray-500">{enrollment.provider_name}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        enrollment.status
                      )}`}
                    >
                      {getStatusIcon(enrollment.status)}
                      <span className="capitalize">{enrollment.status.replace('_', ' ')}</span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Your Contribution:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(enrollment.employee_contribution)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Employer Contribution:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(enrollment.employer_contribution)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200">
                      <span className="text-gray-600 font-medium">Total Monthly:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(enrollment.total_contribution)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Effective Date:
                      </span>
                      <span className="text-gray-900">
                        {format(new Date(enrollment.effective_date), 'dd MMM yyyy')}
                      </span>
                    </div>

                    {enrollment.member_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Member Number:</span>
                        <span className="font-mono text-xs text-gray-900">
                          {enrollment.member_number}
                        </span>
                      </div>
                    )}

                    {enrollment.dependent_count && enrollment.dependent_count > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          Dependents:
                        </span>
                        <span className="text-gray-900">{enrollment.dependent_count}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link
                      to={`/benefits/${enrollment.id}`}
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* YTD Contributions */}
      {ytdContributions && ytdContributions.by_plan.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Year-to-Date Contributions ({new Date().getFullYear()})
            </h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Benefit Plan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Your Contribution
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Employer Contribution
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ytdContributions.by_plan.map((plan, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{plan.plan_name}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(plan.employee_contribution)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatCurrency(plan.employer_contribution)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(plan.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(ytdContributions.total_employee)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(ytdContributions.total_employer)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(ytdContributions.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
