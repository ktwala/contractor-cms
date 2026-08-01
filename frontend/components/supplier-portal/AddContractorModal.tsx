'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { unwrapSupplierPortalList } from '@/lib/supplier-portal-response';
import { WORKER_CLASSIFICATION_OPTIONS } from '@/lib/worker-classification';

interface AddContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface PortalContract {
  id: string;
  contractNumber: string;
  title: string;
}

const ENGAGEMENT_OPTIONS = [
  { value: 'DIRECT', label: 'Direct' },
  { value: 'AGENCY', label: 'Agency' },
];

const RATE_TYPE_OPTIONS = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'FIXED', label: 'Fixed' },
];

const CLASSIFICATION_OPTIONS = WORKER_CLASSIFICATION_OPTIONS;

const defaultForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  workerClassification: 'SUPPLIER_CONTRACTOR',
  engagementModel: 'DIRECT',
  taxResidency: 'ZA',
  contractId: '',
  role: '',
  startDate: '',
  rateType: 'HOURLY',
  rateAmount: '',
  responsibleManagerEmployeeId: '',
  nominationReason: '',
};

export default function AddContractorModal({
  isOpen,
  onClose,
  onCreated,
}: AddContractorModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contracts, setContracts] = useState<PortalContract[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setError('');
    setLoadingContracts(true);
    supplierPortalApi
      .getContracts()
      .then((res) => {
        if (cancelled) return;
        const { items } = unwrapSupplierPortalList<PortalContract>(res);
        setContracts(items);
        if (items.length === 1) {
          setForm((prev) => ({ ...prev, contractId: items[0].id }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load supplier contracts. Try again or contact operations.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingContracts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerClassification) {
      setError('Select a worker classification.');
      return;
    }
    if (!form.contractId) {
      setError('Select a contract for this nomination.');
      return;
    }
    if (!form.role.trim()) {
      setError('Enter a role for the placement.');
      return;
    }
    if (!form.startDate) {
      setError('Enter a placement start date.');
      return;
    }
    const rateAmount = Number(form.rateAmount);
    if (!Number.isFinite(rateAmount) || rateAmount < 0) {
      setError('Enter a valid rate amount.');
      return;
    }

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
        nominationReason: form.nominationReason.trim() || undefined,
        engagement: {
          contractId: form.contractId,
          role: form.role.trim(),
          startDate: form.startDate,
          rateType: form.rateType,
          rateAmount,
          responsibleManagerEmployeeId: form.responsibleManagerEmployeeId.trim() || undefined,
        },
      });
      onCreated();
      onClose();
      setForm(defaultForm);
    } catch {
      setError(
        'Could not nominate external worker. Check the email is unique and all placement fields are valid.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const contractOptions = contracts.map((c) => ({
    value: c.id,
    label: `${c.contractNumber} — ${c.title}`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Nominate ${EXTERNAL_WORKFORCE_LABELS.worker}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Nominate a worker under your supplier. They enter the workforce at{' '}
          <strong>Nominated</strong> — operations must approve activation. You cannot activate
          workers directly from the portal.
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

        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Placement intent</h3>
          {loadingContracts ? (
            <p className="text-sm text-gray-500">Loading contracts…</p>
          ) : contracts.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              No active contracts are linked to your supplier. Contact operations before
              nominating.
            </p>
          ) : (
            <FormSelect
              label="Contract"
              required
              options={contractOptions}
              value={form.contractId}
              onChange={(e) => update('contractId', e.target.value)}
            />
          )}
          <FormInput
            label="Role"
            required
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
            helperText="e.g. Senior Developer"
          />
          <FormInput
            label="Start date"
            type="date"
            required
            value={form.startDate}
            onChange={(e) => update('startDate', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Rate type"
              required
              options={RATE_TYPE_OPTIONS}
              value={form.rateType}
              onChange={(e) => update('rateType', e.target.value)}
            />
            <FormInput
              label="Rate amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.rateAmount}
              onChange={(e) => update('rateAmount', e.target.value)}
            />
          </div>
          <FormInput
            label="Sponsor employee ID (optional)"
            value={form.responsibleManagerEmployeeId}
            onChange={(e) => update('responsibleManagerEmployeeId', e.target.value)}
            helperText="Opaque identifier — operations may assign sponsor later"
          />
        </div>

        <FormInput
          label="Nomination note (optional)"
          value={form.nominationReason}
          onChange={(e) => update('nominationReason', e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || loadingContracts || contracts.length === 0}
          >
            {submitting ? 'Submitting…' : `Nominate ${EXTERNAL_WORKFORCE_LABELS.worker}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
