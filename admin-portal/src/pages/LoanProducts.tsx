import { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Power,
  PowerOff,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle,
  Save,
  X,
} from 'lucide-react';
import api from '../services/api';

interface LoanType {
  id: string;
  code: string;
  name: string;
  description?: string;
  country: string;
  currency: string;
  min_amount: number;
  max_amount: number;
  max_amount_type: string;
  max_amount_multiplier?: number;
  min_tenure_months: number;
  max_tenure_months: number;
  interest_rate: number;
  interest_type: string;
  min_service_months: number;
  max_active_loans: number;
  requires_guarantor: boolean;
  is_active: boolean;
  effective_from: string;
  created_at: string;
}

interface LoanTypeForm {
  code: string;
  name: string;
  description: string;
  country: string;
  currency: string;
  min_amount: string;
  max_amount: string;
  max_amount_type: string;
  max_amount_multiplier: string;
  min_tenure_months: string;
  max_tenure_months: string;
  interest_rate: string;
  interest_type: string;
  min_service_months: string;
  max_active_loans: string;
  requires_guarantor: boolean;
  effective_from: string;
}

export default function LoanProducts() {
  const [loading, setLoading] = useState(true);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<LoanType | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>('all');

  const [form, setForm] = useState<LoanTypeForm>({
    code: '',
    name: '',
    description: '',
    country: 'ZAF',
    currency: 'ZAR',
    min_amount: '',
    max_amount: '',
    max_amount_type: 'fixed',
    max_amount_multiplier: '',
    min_tenure_months: '1',
    max_tenure_months: '12',
    interest_rate: '0',
    interest_type: 'flat',
    min_service_months: '0',
    max_active_loans: '1',
    requires_guarantor: false,
    effective_from: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadLoanTypes();
  }, []);

  const loadLoanTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loans/types?active_only=false');
      setLoanTypes(response.data || []);
    } catch (error) {
      console.error('Failed to load loan types', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    setForm({
      code: '',
      name: '',
      description: '',
      country: 'ZAF',
      currency: 'ZAR',
      min_amount: '',
      max_amount: '',
      max_amount_type: 'fixed',
      max_amount_multiplier: '',
      min_tenure_months: '1',
      max_tenure_months: '12',
      interest_rate: '0',
      interest_type: 'flat',
      min_service_months: '0',
      max_active_loans: '1',
      requires_guarantor: false,
      effective_from: new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleEdit = (type: LoanType) => {
    setEditingType(type);
    setForm({
      code: type.code,
      name: type.name,
      description: type.description || '',
      country: type.country,
      currency: type.currency,
      min_amount: type.min_amount.toString(),
      max_amount: type.max_amount.toString(),
      max_amount_type: type.max_amount_type,
      max_amount_multiplier: type.max_amount_multiplier?.toString() || '',
      min_tenure_months: type.min_tenure_months.toString(),
      max_tenure_months: type.max_tenure_months.toString(),
      interest_rate: type.interest_rate.toString(),
      interest_type: type.interest_type,
      min_service_months: type.min_service_months.toString(),
      max_active_loans: type.max_active_loans.toString(),
      requires_guarantor: type.requires_guarantor,
      effective_from: type.effective_from.split('T')[0],
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        country: form.country,
        currency: form.currency,
        min_amount: parseFloat(form.min_amount),
        max_amount: parseFloat(form.max_amount),
        max_amount_type: form.max_amount_type,
        max_amount_multiplier: form.max_amount_multiplier
          ? parseFloat(form.max_amount_multiplier)
          : undefined,
        min_tenure_months: parseInt(form.min_tenure_months),
        max_tenure_months: parseInt(form.max_tenure_months),
        interest_rate: parseFloat(form.interest_rate),
        interest_type: form.interest_type,
        min_service_months: parseInt(form.min_service_months),
        max_active_loans: parseInt(form.max_active_loans),
        requires_guarantor: form.requires_guarantor,
        effective_from: form.effective_from,
      };

      if (editingType) {
        await api.put(`/loans/types/${editingType.id}`, payload);
        alert('Loan type updated successfully');
      } else {
        await api.post('/loans/types', payload);
        alert('Loan type created successfully');
      }

      setShowModal(false);
      setEditingType(null);
      await loadLoanTypes();
    } catch (error: any) {
      console.error('Failed to save loan type', error);
      alert(error.response?.data?.message || 'Failed to save loan type');
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      if (isActive) {
        await api.post(`/loans/types/${id}/deactivate`);
        alert('Loan type deactivated successfully');
      } else {
        await api.post(`/loans/types/${id}/activate`);
        alert('Loan type activated successfully');
      }
      await loadLoanTypes();
    } catch (error: any) {
      console.error('Failed to toggle status', error);
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const formatCurrency = (value: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

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

  const getInterestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      none: 'Interest-free',
      flat: 'Flat Rate',
      reducing: 'Reducing Balance',
    };
    return labels[type] || type;
  };

  const getMaxAmountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fixed: 'Fixed Amount',
      times_salary: 'Times Monthly Salary',
      percentage_salary: 'Percentage of Salary',
    };
    return labels[type] || type;
  };

  const filteredTypes = loanTypes.filter((type) => {
    if (filterCountry !== 'all' && type.country !== filterCountry) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading loan products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Loan Products</h1>
          <p className="text-gray-600 mt-1">Manage available loan types and terms</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Loan Product
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{loanTypes.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Products</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loanTypes.filter((t) => t.is_active).length}
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
                {new Set(loanTypes.map((t) => t.country)).size}
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
              <p className="text-sm text-gray-600">Interest-Free</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loanTypes.filter((t) => t.interest_type === 'none').length}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Country:</label>
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
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Country
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Range
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenure
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interest
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
              {filteredTypes.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {type.code}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{type.name}</span>
                      {type.description && (
                        <span className="text-xs text-gray-500">{type.description}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getCountryName(type.country)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    <div className="flex flex-col">
                      <span>
                        {formatCurrency(type.min_amount, type.currency)} -{' '}
                        {formatCurrency(type.max_amount, type.currency)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getMaxAmountTypeLabel(type.max_amount_type)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {type.min_tenure_months} - {type.max_tenure_months}m
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{type.interest_rate}% p.a.</span>
                      <span className="text-xs text-gray-500">
                        {getInterestTypeLabel(type.interest_type)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {type.is_active ? (
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
                        onClick={() => handleEdit(type)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(type.id, type.is_active)}
                        className={
                          type.is_active
                            ? 'text-red-600 hover:text-red-700'
                            : 'text-green-600 hover:text-green-700'
                        }
                        title={type.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {type.is_active ? (
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Edit Loan Product' : 'Create Loan Product'}
              </h3>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!editingType}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="e.g., SA_EMERGENCY"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Emergency Loan"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        country: e.target.value,
                        currency:
                          { ZAF: 'ZAR', LSO: 'LSL', BWA: 'BWP', NAM: 'NAD', SWZ: 'SZL' }[
                            e.target.value
                          ] || 'ZAR',
                      })
                    }
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.min_amount}
                    onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.max_amount}
                    onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Amount Type
                  </label>
                  <select
                    value={form.max_amount_type}
                    onChange={(e) => setForm({ ...form, max_amount_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="times_salary">Times Monthly Salary</option>
                    <option value="percentage_salary">Percentage of Salary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Multiplier (if applicable)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.max_amount_multiplier}
                    onChange={(e) => setForm({ ...form, max_amount_multiplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 2.0 for 2x salary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Tenure (months) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.min_tenure_months}
                    onChange={(e) => setForm({ ...form, min_tenure_months: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Tenure (months) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.max_tenure_months}
                    onChange={(e) => setForm({ ...form, max_tenure_months: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.interest_rate}
                    onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interest Type
                  </label>
                  <select
                    value={form.interest_type}
                    onChange={(e) => setForm({ ...form, interest_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">Interest-free</option>
                    <option value="flat">Flat Rate</option>
                    <option value="reducing">Reducing Balance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Service (months)
                  </label>
                  <input
                    type="number"
                    value={form.min_service_months}
                    onChange={(e) => setForm({ ...form, min_service_months: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Active Loans
                  </label>
                  <input
                    type="number"
                    value={form.max_active_loans}
                    onChange={(e) => setForm({ ...form, max_active_loans: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective From <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.effective_from}
                    onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.requires_guarantor}
                      onChange={(e) =>
                        setForm({ ...form, requires_guarantor: e.target.checked })
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">Require guarantor</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {editingType ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
