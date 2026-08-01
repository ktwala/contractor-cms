'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import { supplierMasterCreateLabel } from '@/lib/tenant-authority';
import SupplierEvidenceChecklist from '@/components/suppliers/SupplierEvidenceChecklist';
import { EvidenceChecklistResult } from '@/lib/supplier-evidence';

export type SupplierFormValues = {
  type: 'COMPANY' | 'INDIVIDUAL';
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  country: string;
};

const EMPTY_FORM: SupplierFormValues = {
  type: 'COMPANY',
  companyName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  status: 'PENDING_APPROVAL',
  country: 'ZA',
};

function formatSupplierStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function supplierToFormValues(supplier: Record<string, unknown>): SupplierFormValues {
  return {
    type: (supplier.type as SupplierFormValues['type']) || 'COMPANY',
    companyName: String(supplier.companyName ?? ''),
    firstName: String(supplier.firstName ?? ''),
    lastName: String(supplier.lastName ?? ''),
    email: String(supplier.email ?? ''),
    phone: String(supplier.phone ?? ''),
    status: String(supplier.status ?? 'PENDING_APPROVAL'),
    country: String(supplier.country ?? 'ZA'),
  };
}

export function validateSupplierForm(values: SupplierFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.type) {
    errors.type = 'Supplier type is required';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (values.type === 'COMPANY') {
    if (!values.companyName.trim()) {
      errors.companyName = 'Company name is required';
    }
  } else {
    if (!values.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!values.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
  }

  if (!values.country.trim()) {
    errors.country = 'Country is required';
  }

  return errors;
}

function buildPayload(values: SupplierFormValues) {
  const payload: Record<string, string> = {
    type: values.type,
    email: values.email.trim(),
    country: values.country.trim() || 'ZA',
  };

  if (values.phone.trim()) {
    payload.phone = values.phone.trim();
  }

  if (values.type === 'COMPANY') {
    payload.companyName = values.companyName.trim();
  } else {
    payload.firstName = values.firstName.trim();
    payload.lastName = values.lastName.trim();
  }

  return payload;
}

type SupplierFormModalProps = {
  isOpen: boolean;
  supplierId: string | null;
  onClose: () => void;
  onSaved: (supplier: Record<string, unknown>) => void;
};

export default function SupplierFormModal({
  isOpen,
  supplierId,
  onClose,
  onSaved,
}: SupplierFormModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isEdit = Boolean(supplierId);
  const [formData, setFormData] = useState<SupplierFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checklist, setChecklist] = useState<EvidenceChecklistResult | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (!supplierId) {
      setFormData({ ...EMPTY_FORM });
      setFormErrors({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setChecklistLoading(true);
      setFormErrors({});
      try {
        const [supplier, evidence] = await Promise.all([
          api.getSupplier(supplierId),
          api.getSupplierEvidenceChecklist(supplierId),
        ]);
        if (!cancelled) {
          setFormData(supplierToFormValues(supplier));
          setChecklist(evidence);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? 'Failed to load supplier';
          showToast('error', String(message));
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setChecklistLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, supplierId, onClose, showToast]);

  const handleClose = () => {
    setFormData({ ...EMPTY_FORM });
    setFormErrors({});
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSupplierForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    try {
      const payload = buildPayload(formData);
      const saved = isEdit
        ? await api.updateSupplier(supplierId!, payload)
        : await api.createSupplier(payload);
      showToast('success', isEdit ? 'Supplier updated successfully' : 'Supplier created successfully');
      onSaved(saved);
      handleClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'Failed to save supplier';
      const text = Array.isArray(message) ? message.join(', ') : String(message);
      showToast('error', text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isEdit
          ? 'Edit Supplier'
          : supplierMasterCreateLabel(user?.tenantAuthority)
      }
      size="lg"
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading supplier…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label="Type"
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as SupplierFormValues['type'],
              })
            }
            options={[
              { value: 'COMPANY', label: 'Company' },
              { value: 'INDIVIDUAL', label: 'Individual' },
            ]}
            error={formErrors.type}
            required
          />

          {formData.type === 'COMPANY' ? (
            <FormInput
              label="Company name"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              error={formErrors.companyName}
              required
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="First name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                error={formErrors.firstName}
                required
              />
              <FormInput
                label="Last name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                error={formErrors.lastName}
                required
              />
            </div>
          )}

          <FormInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={formErrors.email}
            required
          />

          <FormInput
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            error={formErrors.phone}
            placeholder="Optional"
          />

          {isEdit && (
            <div className="border-t border-gray-200 pt-4">
              <p className="label mb-2">Onboarding evidence</p>
              <SupplierEvidenceChecklist
                checklist={checklist}
                loading={checklistLoading}
                compact
              />
            </div>
          )}

          <div>
            <p className="label">Lifecycle status</p>
            <p className="text-sm text-gray-700">
              {formatSupplierStatusLabel(formData.status)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Status changes use governed transitions (Settings → supplier lifecycle in a later
              release). New suppliers start as Pending approval.
            </p>
          </div>

          <FormInput
            label="Jurisdiction (country code)"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
            error={formErrors.country}
            placeholder="ZA or LS"
            required
          />
          <p className="text-xs text-gray-500 -mt-2">
            Determines required onboarding evidence pack (ZA, LS).
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Saving…' : isEdit ? 'Update supplier' : 'Create supplier'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
