import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  X,
  Car,
  Utensils,
  Plane,
  Bed,
  Phone,
  Receipt,
  Calendar,
  DollarSign,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface ExpenseCategory {
  id: string;
  name: string;
  icon?: string;
  requires_receipt: boolean;
}

interface ExpenseItem {
  id?: string;
  category_id: string;
  category_name?: string;
  expense_date: string;
  description: string;
  calculation_type: 'fixed_amount' | 'mileage' | 'per_diem';
  amount: number;
  mileage_km?: number;
  from_location?: string;
  to_location?: string;
  has_receipt: boolean;
}

export default function CreateExpenseClaim() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Claim details
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [purpose, setPurpose] = useState('');

  // Step 2: Expense items
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [currentItem, setCurrentItem] = useState<ExpenseItem>({
    category_id: '',
    expense_date: '',
    description: '',
    calculation_type: 'fixed_amount',
    amount: 0,
    has_receipt: false,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/expenses/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'plane':
        return <Plane className="w-5 h-5" />;
      case 'bed':
        return <Bed className="w-5 h-5" />;
      case 'utensils':
        return <Utensils className="w-5 h-5" />;
      case 'car':
        return <Car className="w-5 h-5" />;
      case 'phone':
        return <Phone className="w-5 h-5" />;
      default:
        return <Receipt className="w-5 h-5" />;
    }
  };

  const addItem = () => {
    if (!currentItem.category_id || !currentItem.expense_date || !currentItem.description || currentItem.amount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    const category = categories.find(c => c.id === currentItem.category_id);

    setItems([...items, { ...currentItem, id: Date.now().toString(), category_name: category?.name }]);
    setCurrentItem({
      category_id: '',
      expense_date: '',
      description: '',
      calculation_type: 'fixed_amount',
      amount: 0,
      has_receipt: false,
    });
    setShowAddItem(false);
  };

  const removeItem = (id?: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateMileage = async () => {
    if (!currentItem.mileage_km || currentItem.mileage_km <= 0) return;

    try {
      const response = await api.get('/expenses/policies/mileage-rate/ZAF');
      const rate = response.data.rate || 4.5;
      setCurrentItem({ ...currentItem, amount: currentItem.mileage_km * rate });
    } catch (error) {
      // Default rate
      setCurrentItem({ ...currentItem, amount: currentItem.mileage_km * 4.5 });
    }
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert('Please add at least one expense item');
      return;
    }

    setSubmitting(true);
    try {
      // Create claim
      const claimData = {
        employee_id: 'current',
        claim_date: new Date().toISOString().split('T')[0],
        period_start: periodStart,
        period_end: periodEnd,
        purpose: purpose,
        currency: 'ZAR',
      };

      const claimResponse = await api.post('/expenses/claims', claimData);
      const claimId = claimResponse.data.id;

      // Add items
      for (const item of items) {
        await api.post('/expenses/items', {
          claim_id: claimId,
          category_id: item.category_id,
          expense_date: item.expense_date,
          description: item.description,
          calculation_type: item.calculation_type,
          amount: item.amount,
          mileage_km: item.mileage_km,
          from_location: item.from_location,
          to_location: item.to_location,
          has_receipt: item.has_receipt,
        });
      }

      // Submit for approval
      await api.post(`/expenses/claims/${claimId}/submit`);

      alert('Expense claim submitted successfully!');
      navigate('/expenses');
    } catch (error: any) {
      console.error('Failed to submit claim:', error);
      alert(error.response?.data?.error || 'Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800">Loading categories...</div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (step === 1) {
                navigate('/expenses');
              } else {
                setStep((step - 1) as 1 | 2);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Expense Claim</h1>
            <p className="text-gray-600 mt-1">
              {step === 1 && 'Enter claim period and purpose'}
              {step === 2 && 'Add your expense items'}
              {step === 3 && 'Review and submit your claim'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              1
            </div>
            <span className={`text-sm font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>
              Claim Details
            </span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div className={`h-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} style={{ width: step >= 2 ? '100%' : '0%' }} />
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              2
            </div>
            <span className={`text-sm font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>
              Add Expenses
            </span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div className={`h-full ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} style={{ width: step >= 3 ? '100%' : '0%' }} />
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              3
            </div>
            <span className={`text-sm font-medium ${step >= 3 ? 'text-gray-900' : 'text-gray-500'}`}>
              Review
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Claim Details */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Claim Period & Purpose</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Start Date *
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period End Date *
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose (Optional)
              </label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Client visit to Johannesburg, Conference attendance..."
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={() => {
                if (!periodStart || !periodEnd) {
                  alert('Please select claim period');
                  return;
                }
                setStep(2);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Add Expenses */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Expense Items</h2>
              <button
                onClick={() => setShowAddItem(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>No expenses added yet</p>
                <p className="text-sm mt-1">Click "Add Item" to add your first expense</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="text-gray-400">
                        {getCategoryIcon(categories.find(c => c.id === item.category_id)?.icon)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">{item.category_name}</p>
                          {item.has_receipt && <Receipt className="w-4 h-4 text-green-600" />}
                        </div>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(item.expense_date), 'dd MMM yyyy')}
                          {item.mileage_km && ` • ${item.mileage_km} km`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-4 text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(getTotalAmount())}</span>
                </div>
              </div>
            )}
          </div>

          {/* Add Item Form */}
          {showAddItem && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Expense Item</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={currentItem.category_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={currentItem.expense_date}
                      onChange={(e) => setCurrentItem({ ...currentItem, expense_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentItem.amount || ''}
                      onChange={(e) => setCurrentItem({ ...currentItem, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {currentItem.category_id === 'cat-mileage' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                      <input
                        type="number"
                        value={currentItem.mileage_km || ''}
                        onChange={(e) => setCurrentItem({ ...currentItem, mileage_km: parseFloat(e.target.value) || 0 })}
                        onBlur={calculateMileage}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                      <input
                        type="text"
                        value={currentItem.from_location || ''}
                        onChange={(e) => setCurrentItem({ ...currentItem, from_location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                      <input
                        type="text"
                        value={currentItem.to_location || ''}
                        onChange={(e) => setCurrentItem({ ...currentItem, to_location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={currentItem.description}
                    onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Lunch with client, Taxi to airport..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_receipt"
                    checked={currentItem.has_receipt}
                    onChange={(e) => setCurrentItem({ ...currentItem, has_receipt: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="has_receipt" className="text-sm text-gray-700">
                    I have a receipt for this expense
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddItem(false);
                    setCurrentItem({
                      category_id: '',
                      expense_date: '',
                      description: '',
                      calculation_type: 'fixed_amount',
                      amount: 0,
                      has_receipt: false,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Item
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => {
                if (items.length === 0) {
                  alert('Please add at least one expense item');
                  return;
                }
                setStep(3);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Please review your expense claim carefully. Once submitted, it will be sent to your manager for approval.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Claim Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Claim Period</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(periodStart), 'dd MMM yyyy')} - {format(new Date(periodEnd), 'dd MMM yyyy')}
                </p>
              </div>
              {purpose && (
                <div>
                  <p className="text-sm text-gray-600">Purpose</p>
                  <p className="font-medium text-gray-900">{purpose}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-2">Expense Items ({items.length})</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.category_name}</p>
                        <p className="text-xs text-gray-600">{item.description}</p>
                      </div>
                      <p className="font-medium text-gray-900">{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(getTotalAmount())}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Claim'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
