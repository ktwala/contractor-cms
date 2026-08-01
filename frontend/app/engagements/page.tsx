'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import FormTextarea from '@/components/ui/form-textarea';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Edit, Trash2, Search, Briefcase } from 'lucide-react';
import {
  safeFormatDate,
  safeIsoDatePart,
  safeLower,
  safeString,
} from '@/lib/safe-string';
import {
  formatCurrencyDisplay,
  formatEngagementTitleDisplay,
} from '@/lib/display-format';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { useAuth } from '@/lib/auth-context';

interface Engagement {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  rate: number;
  rateType: string;
  currency: string;
  status: string;
  contractId: string;
  contract?: {
    contractNumber: string;
    contractor?: {
      firstName: string;
      lastName: string;
    };
  };
}

export default function EngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [formData, setFormData] = useState({
    contractId: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    rate: '',
    rateType: 'HOURLY',
    currency: 'ZAR',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const { can } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [engagementsRes, contractsRes] = await Promise.all([
        api.getEngagements({ page: 1, limit: 100 }),
        api.getContracts({ page: 1, limit: 100 }),
      ]);
      setEngagements(engagementsRes.data);
      setContracts(contractsRes.data.filter((c: any) => c.status === 'ACTIVE'));
    } catch (err: any) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (engagement?: Engagement) => {
    if (engagement) {
      setEditingEngagement(engagement);
      setFormData({
        contractId: engagement.contractId,
        title: engagement.title,
        description: engagement.description || '',
        startDate: safeIsoDatePart(engagement.startDate),
        endDate: safeIsoDatePart(engagement.endDate),
        rate: engagement.rate.toString(),
        rateType: engagement.rateType,
        currency: engagement.currency,
        status: engagement.status,
      });
    } else {
      setEditingEngagement(null);
      setFormData({
        contractId: '',
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        rate: '',
        rateType: 'HOURLY',
        currency: 'ZAR',
        status: 'ACTIVE',
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEngagement(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.contractId) errors.contractId = 'Contract is required';
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.startDate) errors.startDate = 'Start date is required';
    if (!formData.rate) errors.rate = 'Rate is required';
    if (formData.endDate && formData.endDate <= formData.startDate) {
      errors.endDate = 'End date must be after start date';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        rate: parseFloat(formData.rate),
      };

      if (editingEngagement) {
        const updated = await api.updateEngagement(editingEngagement.id, payload);
        setEngagements(engagements.map((e) => (e.id === updated.id ? updated : e)));
        showToast('success', 'Engagement updated successfully');
      } else {
        const created = await api.createEngagement(payload);
        setEngagements([created, ...engagements]);
        showToast('success', 'Engagement created successfully');
      }
      handleCloseModal();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save engagement');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEngagements = engagements.filter((engagement) => {
    const searchLower = safeLower(searchTerm);
    const title = safeString(engagement.title);
    const contractNumber = safeString(engagement.contract?.contractNumber);
    return (
      safeLower(title).includes(searchLower) ||
      safeLower(contractNumber).includes(searchLower)
    );
  });

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
    <RequirePermission permission={PERMISSIONS.ENGAGEMENTS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Engagements</h1>
            <p className="text-gray-600 mt-1">Manage contractor work engagements</p>
          </div>
          {can(PERMISSIONS.ENGAGEMENTS.CREATE) && (
            <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Engagement
            </button>
          )}
        </div>

        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by title or contract number..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredEngagements.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No engagements found matching your search' : 'No engagements yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEngagements.map((engagement) => (
                    <tr key={engagement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{formatEngagementTitleDisplay(engagement.title)}</div>
                        {engagement.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {engagement.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {engagement.contract && (
                          <>
                            <div className="text-sm text-gray-900">
                              {engagement.contract.contractNumber || '—'}
                            </div>
                            {engagement.contract.contractor && (
                              <div className="text-sm text-gray-500">
                                {engagement.contract.contractor.firstName}{' '}
                                {engagement.contract.contractor.lastName}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{safeFormatDate(engagement.startDate, 'MMM dd, yyyy')}</div>
                        {engagement.endDate && (
                          <div className="text-xs text-gray-400">
                            to {safeFormatDate(engagement.endDate, 'MMM dd, yyyy')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrencyDisplay(engagement.rate, engagement.currency || 'ZAR')}
                        </div>
                        <div className="text-xs text-gray-500">{engagement.rateType || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={engagement.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {can(PERMISSIONS.ENGAGEMENTS.UPDATE) && (
                          <button
                            onClick={() => handleOpenModal(engagement)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredEngagements.length} of {engagements.length} engagements
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingEngagement ? 'Edit Engagement' : 'Add Engagement'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label="Contract"
            value={formData.contractId}
            onChange={(e) => {
              const contract = contracts.find((c) => c.id === e.target.value);
              setFormData({
                ...formData,
                contractId: e.target.value,
                rate: contract ? contract.rate.toString() : '',
                rateType: contract ? contract.rateType : 'HOURLY',
                currency: contract ? contract.currency : 'ZAR',
              });
            }}
            options={contracts.map((c) => ({
              value: c.id,
              label: `${c.contractNumber} - ${
                c.contractor ? `${c.contractor.firstName} ${c.contractor.lastName}` : ''
              }`,
            }))}
            error={formErrors.contractId}
            required
          />

          <FormInput
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            error={formErrors.title}
            placeholder="e.g., Q1 Development Sprint"
            required
          />

          <FormTextarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the engagement scope..."
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              error={formErrors.startDate}
              required
            />
            <FormInput
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              error={formErrors.endDate}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormInput
              label="Rate"
              type="number"
              step="0.01"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              error={formErrors.rate}
              required
            />
            <FormSelect
              label="Rate Type"
              value={formData.rateType}
              onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
              options={[
                { value: 'HOURLY', label: 'Hourly' },
                { value: 'DAILY', label: 'Daily' },
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'FIXED', label: 'Fixed' },
              ]}
              required
            />
            <FormInput
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              required
            />
          </div>

          <FormSelect
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting
                ? 'Saving...'
                : editingEngagement
                ? 'Update Engagement'
                : 'Create Engagement'}
            </button>
          </div>
        </form>
      </Modal>
      </DashboardLayout>
    </RequirePermission>
  );
}
