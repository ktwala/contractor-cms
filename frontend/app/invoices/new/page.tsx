'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import FormTextarea from '@/components/ui/form-textarea';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Save, Send, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';

interface Timesheet {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  status: string;
  engagement?: {
    id: string;
    title: string;
    rate: number;
    rateType: string;
    currency: string;
    contract?: {
      contractor?: {
        firstName: string;
        lastName: string;
      };
    };
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    engagementId: '',
    invoiceNumber: `INV-${Date.now()}`,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    taxRate: '15', // Default VAT for ZA
  });

  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.engagementId) {
      loadApprovedTimesheets(formData.engagementId);
    } else {
      setTimesheets([]);
      setSelectedTimesheets([]);
    }
  }, [formData.engagementId]);

  const loadData = async () => {
    try {
      const engagementsRes = await api.getEngagements({ page: 1, limit: 100, status: 'ACTIVE' });
      setEngagements(engagementsRes.data);
    } catch (err: any) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovedTimesheets = async (engagementId: string) => {
    try {
      const response = await api.getTimesheets({
        page: 1,
        limit: 100,
        status: 'APPROVED',
        engagementId,
      });
      // Filter out timesheets that are already invoiced
      const uninvoiced = response.data.filter((ts: any) => !ts.invoiceId);
      setTimesheets(uninvoiced);
    } catch (err: any) {
      showToast('error', 'Failed to load timesheets');
    }
  };

  const toggleTimesheet = (id: string) => {
    setSelectedTimesheets((prev) =>
      prev.includes(id) ? prev.filter((tsId) => tsId !== id) : [...prev, id]
    );
  };

  const calculateSubtotal = () => {
    return selectedTimesheets.reduce((sum, tsId) => {
      const ts = timesheets.find((t) => t.id === tsId);
      if (!ts || !ts.engagement) return sum;

      const rate = ts.engagement.rate;
      const hours = ts.totalHours;

      switch (ts.engagement.rateType) {
        case 'HOURLY':
          return sum + rate * hours;
        case 'DAILY':
          return sum + rate * (hours / 8);
        default:
          return sum + rate;
      }
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const taxRate = parseFloat(formData.taxRate) || 0;
    return (subtotal * taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const getTotalHours = () => {
    return selectedTimesheets.reduce((sum, tsId) => {
      const ts = timesheets.find((t) => t.id === tsId);
      return sum + (ts?.totalHours || 0);
    }, 0);
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.engagementId) errors.engagementId = 'Engagement is required';
    if (!formData.invoiceNumber) errors.invoiceNumber = 'Invoice number is required';
    if (!formData.issueDate) errors.issueDate = 'Issue date is required';
    if (!formData.dueDate) errors.dueDate = 'Due date is required';
    if (formData.dueDate && formData.dueDate <= formData.issueDate) {
      errors.dueDate = 'Due date must be after issue date';
    }
    if (selectedTimesheets.length === 0) {
      errors.timesheets = 'Please select at least one timesheet';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const subtotal = calculateSubtotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateTotal();
      const engagement = engagements.find((e) => e.id === formData.engagementId);

      const payload = {
        engagementId: formData.engagementId,
        invoiceNumber: formData.invoiceNumber,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        amount: subtotal,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        currency: engagement?.currency || 'ZAR',
        notes: formData.notes,
        timesheetIds: selectedTimesheets,
        status: submit ? 'PENDING' : 'DRAFT',
      };

      const created = await api.createInvoice(payload);

      if (submit && created.status === 'DRAFT') {
        await api.submitInvoice(created.id);
        showToast('success', 'Invoice created and submitted for approval');
      } else {
        showToast('success', `Invoice saved as ${submit ? 'pending' : 'draft'}`);
      }

      router.push('/invoices');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const engagement = engagements.find((e) => e.id === formData.engagementId);
    const currency = engagement?.currency || 'ZAR';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-gray-600 mt-1">Create invoice from approved timesheets</p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>

            <div className="space-y-4">
              <FormSelect
                label="Engagement"
                value={formData.engagementId}
                onChange={(e) => setFormData({ ...formData, engagementId: e.target.value })}
                options={engagements.map((e) => ({
                  value: e.id,
                  label: `${e.title} - ${
                    e.contract?.contractor
                      ? `${e.contract.contractor.firstName} ${e.contract.contractor.lastName}`
                      : ''
                  }`,
                }))}
                error={formErrors.engagementId}
                required
              />

              <FormInput
                label="Invoice Number"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                error={formErrors.invoiceNumber}
                required
              />

              <div className="grid grid-cols-3 gap-4">
                <FormInput
                  label="Issue Date"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  error={formErrors.issueDate}
                  required
                />
                <FormInput
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  error={formErrors.dueDate}
                  required
                />
                <FormInput
                  label="Tax Rate (%)"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  helperText="e.g., 15 for 15% VAT"
                />
              </div>

              <FormTextarea
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or payment terms..."
              />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Select Timesheets</h2>
              {selectedTimesheets.length > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedTimesheets.length} selected
                </span>
              )}
            </div>

            {formErrors.timesheets && (
              <p className="text-sm text-red-600 mb-4">{formErrors.timesheets}</p>
            )}

            {!formData.engagementId ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Please select an engagement first
              </p>
            ) : timesheets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No approved timesheets available for this engagement
              </p>
            ) : (
              <div className="space-y-2">
                {timesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    onClick={() => toggleTimesheet(timesheet.id)}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTimesheets.includes(timesheet.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-primary-600">
                        {selectedTimesheets.includes(timesheet.id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(timesheet.periodStart), 'MMM dd')} -{' '}
                          {format(new Date(timesheet.periodEnd), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {timesheet.totalHours}h @ {timesheet.engagement?.rateType}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {timesheet.engagement &&
                        formatCurrency(
                          timesheet.engagement.rateType === 'HOURLY'
                            ? timesheet.engagement.rate * timesheet.totalHours
                            : timesheet.engagement.rateType === 'DAILY'
                            ? timesheet.engagement.rate * (timesheet.totalHours / 8)
                            : timesheet.engagement.rate
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTimesheets.length > 0 && (
            <div className="card bg-gray-50">
              <h2 className="text-lg font-semibold mb-4">Invoice Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total Hours</span>
                  <span className="font-medium text-gray-900">{getTotalHours()}h</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Tax ({formData.taxRate}%)</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculateTax())}</span>
                </div>
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-primary-600">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => router.push('/invoices')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <div className="space-x-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-secondary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save as Draft
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="btn btn-primary flex items-center"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit for Approval
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
