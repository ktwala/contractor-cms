import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Shield,
  Users,
  Building2,
  Filter,
  Heart,
  Wallet,
} from 'lucide-react';
import api from '../services/api';

interface BenefitPlan {
  id: string;
  name: string;
  benefit_type: string;
  provider_name?: string;
  is_statutory: boolean;
  is_active: boolean;
  allows_dependents: boolean;
  tax_treatment: string;
  effective_date: string;
  end_date?: string;
}

interface Statistics {
  total_plans: number;
  active_plans: number;
  statutory_plans: number;
  total_enrollments: number;
}

export default function BenefitPlans() {
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  const loadData = async () => {
    try {
      const params: any = {};

      if (typeFilter !== 'all') {
        params.benefit_type = typeFilter;
      }

      if (statusFilter === 'active') {
        params.is_active = true;
      } else if (statusFilter === 'inactive') {
        params.is_active = false;
      }

      const [plansRes] = await Promise.all([
        api.get('/benefits/plans', { params }),
      ]);

      setPlans(plansRes.data || []);

      // Calculate statistics
      setStatistics({
        total_plans: plansRes.data.length,
        active_plans: plansRes.data.filter((p: BenefitPlan) => p.is_active).length,
        statutory_plans: plansRes.data.filter((p: BenefitPlan) => p.is_statutory).length,
        total_enrollments: 0, // TODO: Get from API
      });
    } catch (error) {
      console.error('Failed to load benefit plans', error);
      setPlans([]);
      setStatistics({
        total_plans: 0,
        active_plans: 0,
        statutory_plans: 0,
        total_enrollments: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getBenefitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      medical_aid: 'Medical Aid',
      pension_fund: 'Pension Fund',
      provident_fund: 'Provident Fund',
      retirement_annuity: 'Retirement Annuity',
      group_life: 'Group Life',
      disability_insurance: 'Disability Insurance',
      gap_cover: 'Gap Cover',
      funeral_cover: 'Funeral Cover',
      uif: 'UIF',
      sdl: 'SDL',
      workmen_compensation: 'Workmen Compensation',
      car_allowance: 'Car Allowance',
      housing_subsidy: 'Housing Subsidy',
      other: 'Other',
    };

    return labels[type] || type;
  };

  const getBenefitTypeIcon = (type: string) => {
    switch (type) {
      case 'medical_aid':
      case 'gap_cover':
        return <Heart className="w-4 h-4" />;
      case 'pension_fund':
      case 'provident_fund':
      case 'retirement_annuity':
        return <Wallet className="w-4 h-4" />;
      case 'uif':
      case 'sdl':
      case 'workmen_compensation':
        return <Shield className="w-4 h-4" />;
      case 'group_life':
      case 'disability_insurance':
      case 'funeral_cover':
        return <Users className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getTaxTreatmentLabel = (treatment: string) => {
    const labels: Record<string, string> = {
      taxable: 'Taxable',
      non_taxable: 'Non-Taxable',
      tax_deductible: 'Tax Deductible',
      fringe_benefit: 'Fringe Benefit',
    };

    return labels[treatment] || treatment;
  };

  const getTaxTreatmentColor = (treatment: string) => {
    switch (treatment) {
      case 'tax_deductible':
        return 'bg-green-100 text-green-800';
      case 'non_taxable':
        return 'bg-blue-100 text-blue-800';
      case 'fringe_benefit':
        return 'bg-purple-100 text-purple-800';
      case 'taxable':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading benefit plans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benefit Plans</h1>
          <p className="text-gray-600 mt-1">Manage employee benefit plans and configurations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Plan
        </button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Plans</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.total_plans}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Plans</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.active_plans}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Statutory Benefits</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.statutory_plans}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Enrollments</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.total_enrollments}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Users className="w-6 h-6 text-yellow-600" />
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="medical_aid">Medical Aid</option>
            <option value="pension_fund">Pension Fund</option>
            <option value="provident_fund">Provident Fund</option>
            <option value="retirement_annuity">Retirement Annuity</option>
            <option value="group_life">Group Life</option>
            <option value="disability_insurance">Disability Insurance</option>
            <option value="uif">UIF</option>
            <option value="sdl">SDL</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Treatment
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statutory
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dependents
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p>No benefit plans found</p>
                    <p className="text-sm mt-1">Create a new plan to get started</p>
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/benefits/plans/${plan.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {plan.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">
                          {getBenefitTypeIcon(plan.benefit_type)}
                        </span>
                        <span className="text-sm text-gray-900">
                          {getBenefitTypeLabel(plan.benefit_type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {plan.provider_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getTaxTreatmentColor(
                          plan.tax_treatment
                        )}`}
                      >
                        {getTaxTreatmentLabel(plan.tax_treatment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {plan.is_statutory ? (
                        <Shield className="w-5 h-5 text-purple-600 mx-auto" />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {plan.allows_dependents ? (
                        <Users className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {plan.is_active ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/admin/benefits/plans/${plan.id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <Link
                          to={`/admin/benefits/plans/${plan.id}/edit`}
                          className="text-gray-600 hover:text-gray-700"
                          title="Edit Plan"
                        >
                          <Edit className="w-5 h-5" />
                        </Link>
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
