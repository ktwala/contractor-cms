import { useEffect, useState } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Globe,
  TrendingUp,
  FileText,
  Save,
  X,
  CheckCircle,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  requires_receipt: boolean;
  is_active: boolean;
  created_at: string;
}

interface ExpensePolicy {
  id: string;
  category_id: string;
  category_name?: string;
  policy_type: string;
  country: string;
  currency: string;
  amount?: number;
  unit?: string;
  description?: string;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
}

interface CreateCategoryForm {
  code: string;
  name: string;
  description: string;
  requires_receipt: boolean;
}

interface CreatePolicyForm {
  category_id: string;
  policy_type: string;
  country: string;
  currency: string;
  amount: string;
  unit: string;
  description: string;
  effective_from: string;
}

export default function ExpensePolicies() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [policies, setPolicies] = useState<ExpensePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'policies'>('categories');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<ExpensePolicy | null>(null);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryForm>({
    code: '',
    name: '',
    description: '',
    requires_receipt: false,
  });
  const [policyForm, setPolicyForm] = useState<CreatePolicyForm>({
    category_id: '',
    policy_type: 'per_diem',
    country: 'ZAF',
    currency: 'ZAR',
    amount: '',
    unit: 'day',
    description: '',
    effective_from: new Date().toISOString().split('T')[0],
  });
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterPolicyType, setFilterPolicyType] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, policiesRes] = await Promise.all([
        api.get('/expenses/categories?active_only=false'),
        api.get('/expenses/policies?active_only=false'),
      ]);

      setCategories(categoriesRes.data || []);
      setPolicies(policiesRes.data || []);
    } catch (error) {
      console.error('Failed to load expense policies', error);
      setCategories([]);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      if (!categoryForm.code || !categoryForm.name) {
        alert('Code and Name are required');
        return;
      }

      if (editingCategory) {
        await api.put(`/expenses/categories/${editingCategory.id}`, categoryForm);
        alert('Category updated successfully');
      } else {
        await api.post('/expenses/categories', categoryForm);
        alert('Category created successfully');
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({
        code: '',
        name: '',
        description: '',
        requires_receipt: false,
      });
      await loadData();
    } catch (error: any) {
      console.error('Failed to save category', error);
      alert(error.response?.data?.error || 'Failed to save category');
    }
  };

  const handleCreatePolicy = async () => {
    try {
      if (!policyForm.category_id || !policyForm.amount) {
        alert('Category and Amount are required');
        return;
      }

      const policyData = {
        ...policyForm,
        amount: parseFloat(policyForm.amount),
      };

      if (editingPolicy) {
        await api.put(`/expenses/policies/${editingPolicy.id}`, policyData);
        alert('Policy updated successfully');
      } else {
        await api.post('/expenses/policies', policyData);
        alert('Policy created successfully');
      }

      setShowPolicyModal(false);
      setEditingPolicy(null);
      setPolicyForm({
        category_id: '',
        policy_type: 'per_diem',
        country: 'ZAF',
        currency: 'ZAR',
        amount: '',
        unit: 'day',
        description: '',
        effective_from: new Date().toISOString().split('T')[0],
      });
      await loadData();
    } catch (error: any) {
      console.error('Failed to save policy', error);
      alert(error.response?.data?.error || 'Failed to save policy');
    }
  };

  const handleToggleCategoryStatus = async (categoryId: string, isActive: boolean) => {
    try {
      const action = isActive ? 'deactivate' : 'activate';
      await api.post(`/expenses/categories/${categoryId}/${action}`);
      alert(`Category ${action}d successfully`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to toggle category status', error);
      alert(error.response?.data?.error || 'Failed to update category status');
    }
  };

  const handleTogglePolicyStatus = async (policyId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await api.post(`/expenses/policies/${policyId}/deactivate`);
        alert('Policy deactivated successfully');
      } else {
        alert('Policies cannot be reactivated. Please create a new policy.');
      }
      await loadData();
    } catch (error: any) {
      console.error('Failed to toggle policy status', error);
      alert(error.response?.data?.error || 'Failed to update policy status');
    }
  };

  const openEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      code: category.code,
      name: category.name,
      description: category.description || '',
      requires_receipt: category.requires_receipt,
    });
    setShowCategoryModal(true);
  };

  const openEditPolicy = (policy: ExpensePolicy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      category_id: policy.category_id,
      policy_type: policy.policy_type,
      country: policy.country,
      currency: policy.currency,
      amount: policy.amount?.toString() || '',
      unit: policy.unit || 'day',
      description: policy.description || '',
      effective_from: policy.effective_from.split('T')[0],
    });
    setShowPolicyModal(true);
  };

  const filteredPolicies = policies.filter((policy) => {
    if (filterCountry !== 'all' && policy.country !== filterCountry) return false;
    if (filterPolicyType !== 'all' && policy.policy_type !== filterPolicyType) return false;
    return true;
  });

  const getCountryName = (code: string) => {
    const countries: Record<string, string> = {
      ZAF: 'South Africa',
      LSO: 'Lesotho',
      BWA: 'Botswana',
      NAM: 'Namibia',
      SWZ: 'Eswatini',
    };
    return countries[code] || code;
  };

  const getPolicyTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      per_diem: 'Per Diem',
      mileage_rate: 'Mileage Rate',
      daily_limit: 'Daily Limit',
      monthly_limit: 'Monthly Limit',
      annual_limit: 'Annual Limit',
    };
    return types[type] || type;
  };

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading expense policies...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expense Policies</h1>
          <p className="text-gray-600 mt-1">Manage expense categories and policy rules</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Categories</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {categories.filter((c) => c.is_active).length}
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
              <p className="text-sm text-gray-600">Active Policies</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {policies.filter((p) => p.is_active).length}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Countries</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {new Set(policies.map((p) => p.country)).size}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Policy Types</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {new Set(policies.map((p) => p.policy_type)).size}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Categories</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'policies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Policies & Rates</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'categories' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Expense Categories</h2>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryForm({
                      code: '',
                      name: '',
                      description: '',
                      requires_receipt: false,
                    });
                    setShowCategoryModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receipt Required
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
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {category.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {category.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {category.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {category.requires_receipt ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {category.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditCategory(category)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleToggleCategoryStatus(category.id, category.is_active)
                              }
                              className={
                                category.is_active
                                  ? 'text-red-600 hover:text-red-700'
                                  : 'text-green-600 hover:text-green-700'
                              }
                              title={category.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {category.is_active ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Expense Policies & Rates</h2>
                <button
                  onClick={() => {
                    setEditingPolicy(null);
                    setPolicyForm({
                      category_id: '',
                      policy_type: 'per_diem',
                      country: 'ZAF',
                      currency: 'ZAR',
                      amount: '',
                      unit: 'day',
                      description: '',
                      effective_from: new Date().toISOString().split('T')[0],
                    });
                    setShowPolicyModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Policy
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-4">
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Countries</option>
                  <option value="ZAF">South Africa</option>
                  <option value="LSO">Lesotho</option>
                  <option value="BWA">Botswana</option>
                  <option value="NAM">Namibia</option>
                  <option value="SWZ">Eswatini</option>
                </select>

                <select
                  value={filterPolicyType}
                  onChange={(e) => setFilterPolicyType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Policy Types</option>
                  <option value="per_diem">Per Diem</option>
                  <option value="mileage_rate">Mileage Rate</option>
                  <option value="daily_limit">Daily Limit</option>
                  <option value="monthly_limit">Monthly Limit</option>
                  <option value="annual_limit">Annual Limit</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Policy Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective From
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
                    {filteredPolicies.map((policy) => (
                      <tr key={policy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {policy.category_name || policy.category_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getPolicyTypeLabel(policy.policy_type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getCountryName(policy.country)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {policy.amount ? formatCurrency(policy.amount, policy.currency) : '-'}
                          {policy.unit && policy.unit !== 'once' && (
                            <span className="text-xs text-gray-500 ml-1">/ {policy.unit}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(policy.effective_from), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {policy.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditPolicy(policy)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {policy.is_active && (
                              <button
                                onClick={() => handleTogglePolicyStatus(policy.id, policy.is_active)}
                                className="text-red-600 hover:text-red-700"
                                title="Deactivate"
                              >
                                <PowerOff className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., TRAVEL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Travel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of this category"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_receipt"
                  checked={categoryForm.requires_receipt}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, requires_receipt: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_receipt" className="ml-2 block text-sm text-gray-900">
                  Require receipt for this category
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPolicy ? 'Edit Policy' : 'Add Policy'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={policyForm.category_id}
                  onChange={(e) => setPolicyForm({ ...policyForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories
                    .filter((c) => c.is_active)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={policyForm.policy_type}
                  onChange={(e) => setPolicyForm({ ...policyForm, policy_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="per_diem">Per Diem</option>
                  <option value="mileage_rate">Mileage Rate</option>
                  <option value="daily_limit">Daily Limit</option>
                  <option value="monthly_limit">Monthly Limit</option>
                  <option value="annual_limit">Annual Limit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={policyForm.country}
                  onChange={(e) => {
                    const country = e.target.value;
                    const currencyMap: Record<string, string> = {
                      ZAF: 'ZAR',
                      LSO: 'LSL',
                      BWA: 'BWP',
                      NAM: 'NAD',
                      SWZ: 'SZL',
                    };
                    setPolicyForm({
                      ...policyForm,
                      country,
                      currency: currencyMap[country] || 'ZAR',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ZAF">South Africa</option>
                  <option value="LSO">Lesotho</option>
                  <option value="BWA">Botswana</option>
                  <option value="NAM">Namibia</option>
                  <option value="SWZ">Eswatini</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={policyForm.currency}
                  onChange={(e) => setPolicyForm({ ...policyForm, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ZAR"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={policyForm.amount}
                  onChange={(e) => setPolicyForm({ ...policyForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 550.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  value={policyForm.unit}
                  onChange={(e) => setPolicyForm({ ...policyForm, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="day">Per Day</option>
                  <option value="km">Per Kilometer</option>
                  <option value="month">Per Month</option>
                  <option value="year">Per Year</option>
                  <option value="once">One-time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={policyForm.effective_from}
                  onChange={(e) => setPolicyForm({ ...policyForm, effective_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={policyForm.description}
                  onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of this policy"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPolicyModal(false);
                  setEditingPolicy(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel
              </button>
              <button
                onClick={handleCreatePolicy}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {editingPolicy ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
