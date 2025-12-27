'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Trash2, Save, Send } from 'lucide-react';

interface TimeEntry {
  date: string;
  hours: number;
  description: string;
}

export default function NewTimesheetPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [engagements, setEngagements] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    engagementId: '',
    projectId: '',
    periodStart: '',
    periodEnd: '',
  });

  const [entries, setEntries] = useState<TimeEntry[]>([
    { date: '', hours: 0, description: '' },
  ]);

  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [engagementsRes, projectsRes] = await Promise.all([
        api.getEngagements({ page: 1, limit: 100, status: 'ACTIVE' }),
        api.getProjects({ page: 1, limit: 100, status: 'ACTIVE' }),
      ]);
      setEngagements(engagementsRes.data);
      setProjects(projectsRes.data);
    } catch (err: any) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addEntry = () => {
    setEntries([...entries, { date: '', hours: 0, description: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) {
      showToast('error', 'At least one entry is required');
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof TimeEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const getTotalHours = () => {
    return entries.reduce((sum, entry) => sum + (parseFloat(entry.hours.toString()) || 0), 0);
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.engagementId) errors.engagementId = 'Engagement is required';
    if (!formData.projectId) errors.projectId = 'Project is required';
    if (!formData.periodStart) errors.periodStart = 'Period start is required';
    if (!formData.periodEnd) errors.periodEnd = 'Period end is required';

    if (formData.periodEnd && formData.periodEnd <= formData.periodStart) {
      errors.periodEnd = 'Period end must be after period start';
    }

    const hasValidEntry = entries.some(e => e.date && e.hours > 0);
    if (!hasValidEntry) {
      errors.entries = 'At least one valid time entry is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        entries: entries.filter(e => e.date && e.hours > 0),
        status: submit ? 'SUBMITTED' : 'DRAFT',
      };

      const created = await api.createTimesheet(payload);

      if (submit && created.status === 'DRAFT') {
        // Submit it
        await api.submitTimesheet(created.id);
        showToast('success', 'Timesheet created and submitted for approval');
      } else {
        showToast('success', `Timesheet saved as ${submit ? 'submitted' : 'draft'}`);
      }

      router.push('/timesheets');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to create timesheet');
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">New Timesheet</h1>
          <p className="text-gray-600 mt-1">Record contractor hours for approval</p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Timesheet Details</h2>

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

              <FormSelect
                label="Project"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                error={formErrors.projectId}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Period Start"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  error={formErrors.periodStart}
                  required
                />
                <FormInput
                  label="Period End"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  error={formErrors.periodEnd}
                  required
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Time Entries</h2>
              <button
                type="button"
                onClick={addEntry}
                className="btn btn-secondary flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Entry
              </button>
            </div>

            {formErrors.entries && (
              <p className="text-sm text-red-600 mb-4">{formErrors.entries}</p>
            )}

            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        className="input text-sm"
                        value={entry.date}
                        onChange={(e) => updateEntry(index, 'date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Hours
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        className="input text-sm"
                        value={entry.hours}
                        onChange={(e) =>
                          updateEntry(index, 'hours', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Task description"
                        value={entry.description}
                        onChange={(e) => updateEntry(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="mt-6 text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Hours</span>
                <span className="text-lg font-bold text-primary-600">{getTotalHours()}h</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => router.push('/timesheets')}
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
