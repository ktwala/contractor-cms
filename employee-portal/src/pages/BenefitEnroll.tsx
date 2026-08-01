import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Wallet,
  Shield,
  Users,
  Info,
  ArrowLeft,
  Plus,
  X,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface BenefitPlan {
  id: string;
  name: string;
  benefit_type: string;
  provider_name?: string;
  description?: string;
  is_statutory: boolean;
  allows_dependents: boolean;
  tax_treatment: string;
  options?: BenefitPlanOption[];
  rates?: BenefitRate[];
}

interface BenefitPlanOption {
  id: string;
  option_name: string;
  coverage_level: string;
  description?: string;
}

interface BenefitRate {
  id: string;
  rate_type: string;
  employee_amount?: number;
  employer_amount?: number;
  employee_percentage?: number;
  employer_percentage?: number;
  monthly_cap?: number;
}

interface Dependent {
  first_name: string;
  last_name: string;
  relationship: string;
  date_of_birth: string;
  id_number?: string;
}

export default function BenefitEnroll() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BenefitPlan | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    loadAvailablePlans();
  }, []);

  const loadAvailablePlans = async () => {
    try {
      const response = await api.get('/benefits/plans', {
        params: { is_active: true },
      });

      setPlans(response.data || []);
    } catch (error) {
      console.error('Failed to load benefit plans:', error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: BenefitPlan) => {
    setSelectedPlan(plan);
    setSelectedOption('');
    setDependents([]);
    setStep(2);
  };

  const addDependent = () => {
    setDependents([
      ...dependents,
      {
        first_name: '',
        last_name: '',
        relationship: 'spouse',
        date_of_birth: '',
        id_number: '',
      },
    ]);
  };

  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  const updateDependent = (index: number, field: keyof Dependent, value: string) => {
    const updated = [...dependents];
    updated[index] = { ...updated[index], [field]: value };
    setDependents(updated);
  };

  const handleSubmit = async () => {
    if (!selectedPlan) return;

    setSubmitting(true);
    try {
      // Get rate to calculate contributions
      const rate = selectedPlan.rates?.[0];
      let employeeContribution = 0;
      let employerContribution = 0;

      if (rate) {
        if (rate.rate_type === 'fixed_amount') {
          employeeContribution = rate.employee_amount || 0;
          employerContribution = rate.employer_amount || 0;
        } else if (rate.rate_type === 'percentage_of_salary') {
          // For demo, assume R20000 monthly salary
          const salary = 20000;
          employeeContribution = salary * (rate.employee_percentage || 0) / 100;
          employerContribution = salary * (rate.employer_percentage || 0) / 100;
        }
      }

      // Create enrollment
      const enrollmentData = {
        employee_id: 'current',
        plan_id: selectedPlan.id,
        option_id: selectedOption || undefined,
        enrollment_date: new Date().toISOString().split('T')[0],
        effective_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        employee_contribution: employeeContribution,
        employer_contribution: employerContribution,
      };

      const response = await api.post('/benefits/enrollments', enrollmentData);

      // Add dependents if any
      if (dependents.length > 0) {
        for (const dependent of dependents) {
          await api.post('/benefits/dependents', {
            enrollment_id: response.data.id,
            ...dependent,
            effective_date: enrollmentData.effective_date,
          });
        }
      }

      alert('Benefit enrollment submitted successfully! Pending approval from HR.');
      navigate('/benefits');
    } catch (error: any) {
      console.error('Failed to submit enrollment:', error);
      alert(error.response?.data?.error || 'Failed to submit enrollment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getBenefitTypeIcon = (type: string) => {
    switch (type) {
      case 'medical_aid':
      case 'gap_cover':
        return <Heart className="w-6 h-6" />;
      case 'pension_fund':
      case 'provident_fund':
        return <Wallet className="w-6 h-6" />;
      case 'uif':
      case 'sdl':
        return <Shield className="w-6 h-6" />;
      default:
        return <Users className="w-6 h-6" />;
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const calculateEstimatedContribution = () => {
    if (!selectedPlan || !selectedPlan.rates || selectedPlan.rates.length === 0) {
      return { employee: 0, employer: 0 };
    }

    const rate = selectedPlan.rates[0];

    if (rate.rate_type === 'fixed_amount') {
      return {
        employee: rate.employee_amount || 0,
        employer: rate.employer_amount || 0,
      };
    } else if (rate.rate_type === 'percentage_of_salary') {
      // For demo, assume R20000 monthly salary
      const salary = 20000;
      return {
        employee: salary * (rate.employee_percentage || 0) / 100,
        employer: salary * (rate.employer_percentage || 0) / 100,
      };
    }

    return { employee: 0, employer: 0 };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading available benefits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (step === 1) {
                navigate('/benefits');
              } else {
                setStep((step - 1) as 1 | 2);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enroll in Benefit</h1>
            <p className="text-gray-600 mt-1">
              {step === 1 && 'Choose a benefit plan to enroll in'}
              {step === 2 && 'Select options and add dependents'}
              {step === 3 && 'Review and confirm your enrollment'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              1
            </div>
            <span className={`text-sm font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>
              Choose Plan
            </span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div
              className={`h-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}
              style={{ width: step >= 2 ? '100%' : '0%' }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              2
            </div>
            <span className={`text-sm font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>
              Configure
            </span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div
              className={`h-full ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}
              style={{ width: step >= 3 ? '100%' : '0%' }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              3
            </div>
            <span className={`text-sm font-medium ${step >= 3 ? 'text-gray-900' : 'text-gray-500'}`}>
              Review
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Choose Plan */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
              onClick={() => handleSelectPlan(plan)}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${getBenefitTypeColor(plan.benefit_type)}`}>
                  {getBenefitTypeIcon(plan.benefit_type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  {plan.provider_name && (
                    <p className="text-sm text-gray-500">{plan.provider_name}</p>
                  )}
                  {plan.description && (
                    <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    {plan.is_statutory && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Statutory
                      </span>
                    )}
                    {plan.allows_dependents && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Users className="w-3 h-3 mr-1" />
                        Dependents
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {plan.tax_treatment.replace('_', ' ')}
                    </span>
                  </div>

                  {plan.rates && plan.rates.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">Estimated Monthly Contribution:</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {plan.rates[0].rate_type === 'fixed_amount'
                          ? formatCurrency(plan.rates[0].employee_amount || 0)
                          : `${plan.rates[0].employee_percentage}% of salary`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && selectedPlan && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Selected Plan</h2>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${getBenefitTypeColor(selectedPlan.benefit_type)}`}>
                {getBenefitTypeIcon(selectedPlan.benefit_type)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedPlan.name}</h3>
                {selectedPlan.provider_name && (
                  <p className="text-sm text-gray-500">{selectedPlan.provider_name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Plan Options */}
          {selectedPlan.options && selectedPlan.options.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Coverage Options</h2>
              <div className="space-y-3">
                {selectedPlan.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="option"
                      value={option.id}
                      checked={selectedOption === option.id}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{option.option_name}</p>
                      <p className="text-sm text-gray-600">{option.description}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        Coverage: {option.coverage_level.replace('_', ' ')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Dependents */}
          {selectedPlan.allows_dependents && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Add Dependents</h2>
                <button
                  onClick={addDependent}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Dependent
                </button>
              </div>

              {dependents.length === 0 ? (
                <p className="text-sm text-gray-500">No dependents added yet.</p>
              ) : (
                <div className="space-y-4">
                  {dependents.map((dependent, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-gray-900">Dependent {index + 1}</h3>
                        <button
                          onClick={() => removeDependent(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={dependent.first_name}
                            onChange={(e) => updateDependent(index, 'first_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={dependent.last_name}
                            onChange={(e) => updateDependent(index, 'last_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Relationship
                          </label>
                          <select
                            value={dependent.relationship}
                            onChange={(e) => updateDependent(index, 'relationship', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="spouse">Spouse</option>
                            <option value="child">Child</option>
                            <option value="partner">Partner</option>
                            <option value="parent">Parent</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={dependent.date_of_birth}
                            onChange={(e) => updateDependent(index, 'date_of_birth', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ID Number (Optional)
                          </label>
                          <input
                            type="text"
                            value={dependent.id_number}
                            onChange={(e) => updateDependent(index, 'id_number', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && selectedPlan && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900">
                  Please review your enrollment details carefully. Your enrollment will be submitted
                  for HR approval and you will be notified once it's been reviewed.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Summary</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Benefit Plan</p>
                <p className="text-lg font-medium text-gray-900">{selectedPlan.name}</p>
                {selectedPlan.provider_name && (
                  <p className="text-sm text-gray-500">{selectedPlan.provider_name}</p>
                )}
              </div>

              {selectedOption && selectedPlan.options && (
                <div>
                  <p className="text-sm text-gray-600">Coverage Option</p>
                  <p className="font-medium text-gray-900">
                    {selectedPlan.options.find((o) => o.id === selectedOption)?.option_name}
                  </p>
                </div>
              )}

              {dependents.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Dependents ({dependents.length})</p>
                  <ul className="mt-2 space-y-1">
                    {dependents.map((dep, i) => (
                      <li key={i} className="text-sm text-gray-900">
                        • {dep.first_name} {dep.last_name} ({dep.relationship})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Estimated Monthly Contributions</p>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Your Contribution:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(calculateEstimatedContribution().employee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Employer Contribution:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(calculateEstimatedContribution().employer)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-medium text-gray-900">Total Monthly:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        calculateEstimatedContribution().employee +
                        calculateEstimatedContribution().employer
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Effective Date</p>
                <p className="font-medium text-gray-900">
                  {format(
                    new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    'dd MMMM yyyy'
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Benefits will start from the 1st of next month
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start space-x-3">
              <input type="checkbox" id="confirm" className="mt-1" required />
              <label htmlFor="confirm" className="text-sm text-gray-700">
                I confirm that the information provided is accurate and I understand that my
                enrollment will be reviewed by HR. I will need to provide supporting documents for
                verification.
              </label>
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Enrollment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
