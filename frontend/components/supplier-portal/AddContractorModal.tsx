'use client';

import { useState } from 'react';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import { supplierPortalApi } from '@/lib/api-supplier-portal';

interface AddContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const ENGAGEMENT_OPTIONS = [
  { value: 'DIRECT', label: 'Direct' },
  { value: 'AGENCY', label: 'Agency' },
];

const CLASSIFICATION_OPTIONS = [
  { value: 'INDEPENDENT_CONTRACTOR', label: 'Independent contractor' },
];

export default function AddContractorModal({
  isOpen,
  onClose,
  onCreated,
}: AddContractorModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    workerClassification: 'INDEPENDENT_CONTRACTOR',
    engagementModel: 'DIRECT',
    taxResidency: 'ZA',
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await supplierPortalApi.createContractor({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        workerClassification: form.workerClassification,
        engagementModel: form.engagementModel,
        taxResidency: form.taxResidency,
      });
      onCreated();
      onClose();
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
      });
    } catch {
      setError('Could not add contractor. Check the email is unique for your supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add contractor" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Add a contractor under your supplier. Your supplier contractors only — not the
          client-wide contractor registry.
        </p>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="First name"
            required
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
          <FormInput
            label="Last name"
            required
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </div>
        <FormInput
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <FormInput
          label="Phone"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="Classification"
            required
            options={CLASSIFICATION_OPTIONS}
            value={form.workerClassification}
            onChange={(e) => update('workerClassification', e.target.value)}
          />
          <FormSelect
            label="Engagement model"
            required
            options={ENGAGEMENT_OPTIONS}
            value={form.engagementModel}
            onChange={(e) => update('engagementModel', e.target.value)}
          />
        </div>
        <FormInput
          label="Tax residency (country code)"
          required
          value={form.taxResidency}
          onChange={(e) => update('taxResidency', e.target.value)}
          helperText="e.g. ZA for South Africa"
        />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Add contractor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
