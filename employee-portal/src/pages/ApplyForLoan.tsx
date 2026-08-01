import { useEffect, useState } from 'react';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
}

interface RepaymentCalculation {
  monthlyDeduction: number;
  totalRepayment: number;
  totalInterest: number;
}

export default function ApplyForLoan() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Employee settings
  const [country] = useState('ZAF');
  const [currency] = useState('ZAR');

  // Loan types
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [selectedType, setSelectedType] = useState<LoanType | null>(null);
  const [maxAmount, setMaxAmount] = useState<number>(0);

  // Form data
  const [amount, setAmount] = useState<string>('');
  const [tenure, setTenure] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [guarantorId, setGuarantorId] = useState<string>('');

  // Calculation
  const [repayment, setRepayment] = useState<RepaymentCalculation | null>(null);

  useEffect(() => {
    loadLoanTypes();
  }, []);

  const loadLoanTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/api/loans/types/available/current?country=${country}`
      );
      setLoanTypes(response.data || []);
    } catch (error) {
      console.error('Failed to load loan types', error);
      setLoanTypes([]);
    } finally {
      setLoading(false);
    }
  }

    ;

  const loadMaxAmount = async (loanTypeId: string) => {
    try {
      const response = await api.get(`/loans/types/${loanTypeId}/max-amount/current`);
      setMaxAmount(response.data.max_amount || 0);
    } catch (error) {
      console.error('Failed to load max amount', error);
      setMaxAmount(0);
    }
  };

  const handleLoanTypeSelect = async (typeId: string) => {
    const type = loanTypes.find((t) => t.id === typeId);
    if (type) {
      setSelectedType(type);
      await loadMaxAmount(typeId);
      // Reset form
      setAmount('');
      setTenure(type.min_tenure_months.toString());
      setPurpose('');
      setRepayment(null);
    }
  };

  const calculateRepayment = async () => {
    if (!selectedType || !amount || !tenure) {
      return;
    }

    try {
      const response = await api.post('/loans/types/calculate-repayment', {
        principal: parseFloat(amount),
        interest_rate: selectedType.interest_rate,
        tenure_months: parseInt(tenure),
        interest_type: selectedType.interest_type,
      });

      setRepayment(response.data);
    } catch (error) {
      console.error('Failed to calculate repayment', error);
      alert('Failed to calculate repayment');
    }
  };

  useEffect(() => {
    if (selectedType && amount && tenure) {
      const amountNum = parseFloat(amount);
      const tenureNum = parseInt(tenure);

      if (
        amountNum >= selectedType.min_amount &&
        amountNum <= maxAmount &&
        tenureNum >= selectedType.min_tenure_months &&
        tenureNum <= selectedType.max_tenure_months
      ) {
        calculateRepayment();
      }
    }
  }, [amount, tenure, selectedType]);

  const validateStep1 = (): boolean => {
    if (!selectedType) {
      alert('Please select a loan type');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      alert('Please enter a valid amount');
      return false;
    }

    if (amountNum < selectedType.min_amount) {
      alert(`Minimum amount is ${formatCurrency(selectedType.min_amount)}`);
      return false;
    }

    if (amountNum > maxAmount) {
      alert(`Maximum amount is ${formatCurrency(maxAmount)}`);
      return false;
    }

    const tenureNum = parseInt(tenure);
    if (!tenure || isNaN(tenureNum)) {
      alert('Please enter a valid tenure');
      return false;
    }

    if (tenureNum < selectedType.min_tenure_months || tenureNum > selectedType.max_tenure_months) {
      alert(
        `Tenure must be between ${selectedType.min_tenure_months} and ${selectedType.max_tenure_months} months`
      );
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (selectedType?.requires_guarantor && !guarantorId) {
      alert('A guarantor is required for this loan type');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((prev) => (prev === 3 ? 3 : ((prev + 1) as 1 | 2 | 3)));
  };

  const handleBack = () => {
    setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3)));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Create application
      const applicationData = {
        employee_id: 'current',
        loan_type_id: selectedType?.id,
        requested_amount: parseFloat(amount),
        tenure_months: parseInt(tenure),
        purpose: purpose || undefined,
        guarantor_employee_id: guarantorId || undefined,
      };

      const response = await api.post('/loans/applications', applicationData);
      const applicationId = response.data.id;

      // Submit for approval
      await api.post(`/loans/applications/${applicationId}/submit`);

      alert('Loan application submitted successfully!');
      navigate('/loans');
    } catch (error: any) {
      console.error('Failed to submit loan application', error);
      alert(error.response?.data?.message || 'Failed to submit loan application');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const getInterestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      none: 'Interest-free',
      flat: 'Flat Rate',
      reducing: 'Reducing Balance',
    };
    return labels[type] || type;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading loan types...</div>
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Apply for Loan</h1>
        <p className="text-gray-600 mt-1">Complete the application form to request a loan</p>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              1
            </div>
            <span className={`font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>
              Loan Details
            </span>
          </div>

          <div className="flex-1 h-1 bg-gray-200 mx-4">
            <div
              className={`h-full transition-all ${step >= 2 ? 'bg-blue-600 w-full' : 'w-0'}`}
            />
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              2
            </div>
            <span className={`font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>
              Additional Info
            </span>
          </div>

          <div className="flex-1 h-1 bg-gray-200 mx-4">
            <div
              className={`h-full transition-all ${step >= 3 ? 'bg-blue-600 w-full' : 'w-0'}`}
            />
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
            >
              3
            </div>
            <span className={`font-medium ${step >= 3 ? 'text-gray-900' : 'text-gray-500'}`}>
              Review & Submit
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Loan Details */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Select Loan Type & Amount</h2>

          {/* Loan Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedType?.id || ''}
              onChange={(e) => handleLoanTypeSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a loan type</option>
              {loanTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} - {getInterestTypeLabel(type.interest_type)}{' '}
                  {type.interest_rate > 0 && `(${type.interest_rate}% p.a.)`}
                </option>
              ))}
            </select>
          </div>

          {selectedType && (
            <>
              {/* Loan Type Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">{selectedType.name}</h3>
                <p className="text-sm text-blue-800 mb-3">{selectedType.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Amount Range:</span>
                    <p className="font-medium text-blue-900">
                      {formatCurrency(selectedType.min_amount)} -{' '}
                      {formatCurrency(maxAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-700">Tenure:</span>
                    <p className="font-medium text-blue-900">
                      {selectedType.min_tenure_months} - {selectedType.max_tenure_months} months
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-700">Interest Rate:</span>
                    <p className="font-medium text-blue-900">
                      {selectedType.interest_rate}% p.a. ({getInterestTypeLabel(selectedType.interest_type)})
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-700">Guarantor:</span>
                    <p className="font-medium text-blue-900">
                      {selectedType.requires_guarantor ? 'Required' : 'Not Required'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Amount ({currency}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Enter amount (${formatCurrency(selectedType.min_amount)} - ${formatCurrency(maxAmount)})`}
                />
              </div>

              {/* Tenure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repayment Period (Months) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Enter months (${selectedType.min_tenure_months} - ${selectedType.max_tenure_months})`}
                />
              </div>

              {/* Repayment Calculation */}
              {repayment && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <Calculator className="w-5 h-5 text-green-600 mr-2" />
                    <h3 className="font-medium text-green-900">Repayment Summary</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-green-700">Monthly Deduction</p>
                      <p className="text-lg font-bold text-green-900">
                        {formatCurrency(repayment.monthlyDeduction)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Total Interest</p>
                      <p className="text-lg font-bold text-green-900">
                        {formatCurrency(repayment.totalInterest)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Total Repayment</p>
                      <p className="text-lg font-bold text-green-900">
                        {formatCurrency(repayment.totalRepayment)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Additional Info */}
      {step === 2 && selectedType && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Additional Information</h2>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose of Loan (Optional)
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Please provide details about how you plan to use this loan..."
            />
          </div>

          {/* Guarantor */}
          {selectedType.requires_guarantor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guarantor Employee ID <span className="text-red-500">*</span>
              </label>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Guarantor Required</p>
                    <p>
                      This loan type requires a guarantor. Please provide the employee ID of a
                      colleague who will act as your guarantor. They will need to consent to this
                      arrangement.
                    </p>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={guarantorId}
                onChange={(e) => setGuarantorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter guarantor's employee ID"
              />
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Terms & Conditions</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Loan repayments will be automatically deducted from your monthly salary</li>
              <li>You cannot have more than {selectedType.max_active_loans} active loan(s) at a time</li>
              <li>Early settlement may be subject to fees or penalties</li>
              <li>Failure to repay may affect future loan applications</li>
              <li>Your employment status must remain active during the repayment period</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && selectedType && repayment && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Review Your Application</h2>

          <div className="space-y-4">
            {/* Loan Details */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-medium text-gray-900 mb-3">Loan Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Loan Type:</span>
                  <p className="font-medium text-gray-900">{selectedType.name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Requested Amount:</span>
                  <p className="font-medium text-gray-900">{formatCurrency(parseFloat(amount))}</p>
                </div>
                <div>
                  <span className="text-gray-600">Repayment Period:</span>
                  <p className="font-medium text-gray-900">{tenure} months</p>
                </div>
                <div>
                  <span className="text-gray-600">Interest Rate:</span>
                  <p className="font-medium text-gray-900">
                    {selectedType.interest_rate}% p.a. ({getInterestTypeLabel(selectedType.interest_type)})
                  </p>
                </div>
              </div>
            </div>

            {/* Repayment Summary */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-medium text-gray-900 mb-3">Repayment Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <span className="text-blue-700">Monthly Deduction</span>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(repayment.monthlyDeduction)}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <span className="text-purple-700">Total Interest</span>
                  <p className="text-xl font-bold text-purple-900">
                    {formatCurrency(repayment.totalInterest)}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <span className="text-green-700">Total Repayment</span>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(repayment.totalRepayment)}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {(purpose || guarantorId) && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Additional Information</h3>
                <div className="space-y-2 text-sm">
                  {purpose && (
                    <div>
                      <span className="text-gray-600">Purpose:</span>
                      <p className="text-gray-900">{purpose}</p>
                    </div>
                  )}
                  {guarantorId && (
                    <div>
                      <span className="text-gray-600">Guarantor ID:</span>
                      <p className="text-gray-900">{guarantorId}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important</p>
                <p>
                  By submitting this application, you agree to the repayment terms and authorize
                  automatic deductions from your salary. Please ensure all information is correct
                  before proceeding.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        )}

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={!selectedType}
            className="ml-auto inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="ml-auto inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
