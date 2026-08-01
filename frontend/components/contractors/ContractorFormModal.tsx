'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import FormTextarea from '@/components/ui/form-textarea';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import { WORKER_CLASSIFICATION_OPTIONS } from '@/lib/worker-classification';
import {
  EXTERNAL_WORKFORCE_LABELS,
  INTERNAL_ACCOUNTABILITY_LABELS,
} from '@/lib/external-workforce-labels';
import {
  isOperationalTrustGranted,
  OPERATIONAL_TRUST_LABELS,
  supplierSelectLabel,
} from '@/lib/operational-trust-labels';
import { OperationalTrustWorkerBlock } from '@/components/suppliers/OperationalTrustWorkerBlock';

export interface ContractorFormSupplier {
  id: string;
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tradingName?: string;
  status?: string;
  externalSupplierId?: string | null;
}

export interface ContractorFormContractor {
  id: string;
  supplierId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  idNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  status: string;
  workerClassification?: string;
  engagementModel?: string;
}

type FormValues = {
  supplierId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  taxNumber: string;
  idNumber: string;
  dateOfBirth: string;
  nationality: string;
  status: string;
  workerClassification: string;
  engagementModel: string;
  sponsorNote: string;
};

const EMPTY_FORM: FormValues = {
  supplierId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  taxNumber: '',
  idNumber: '',
  dateOfBirth: '',
  nationality: 'ZA',
  status: 'ACTIVE',
  workerClassification: '',
  engagementModel: 'DIRECT',
  sponsorNote: '',
};

function contractorToFormValues(contractor: ContractorFormContractor): FormValues {
  return {
    supplierId: contractor.supplierId,
    firstName: contractor.firstName,
    lastName: contractor.lastName,
    email: contractor.email,
    phone: contractor.phone || '',
    taxNumber: contractor.taxNumber || '',
    idNumber: contractor.idNumber || '',
    dateOfBirth: contractor.dateOfBirth || '',
    nationality: contractor.nationality || 'ZA',
    status: contractor.status,
    workerClassification: contractor.workerClassification || '',
    engagementModel: contractor.engagementModel || 'DIRECT',
    sponsorNote: '',
  };
}

function FormSection({
  title,
  description,
  children,
  first,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section
      className={
        first
          ? 'space-y-4'
          : 'space-y-4 border-t border-card-border pt-5'
      }
    >
      <div>
        <h4 className="text-sm font-semibold text-content">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-xs text-content-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type ContractorFormModalProps = {
  isOpen: boolean;
  contractor: ContractorFormContractor | null;
  suppliers: ContractorFormSupplier[];
  onClose: () => void;
  onSaved: (contractor: Record<string, unknown>, mode: 'create' | 'update') => void;
};

export default function ContractorFormModal({
  isOpen,
  contractor,
  suppliers,
  onClose,
  onSaved,
}: ContractorFormModalProps) {
  const { showToast } = useToast();
  const isEdit = contractor !== null;
  const [formData, setFormData] = useState<FormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(contractor ? contractorToFormValues(contractor) : EMPTY_FORM);
    setFormErrors({});
  }, [isOpen, contractor]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.supplierId) errors.supplierId = 'Supplier is required';
    else if (!isEdit) {
      const supplier = suppliers.find((s) => s.id === formData.supplierId);
      if (supplier?.status && !isOperationalTrustGranted(supplier.status)) {
        errors.supplierId = OPERATIONAL_TRUST_LABELS.workerBlockTrustNotGranted;
      }
    }
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address';
    }
    if (!formData.workerClassification) {
      errors.workerClassification = 'Worker classification is required';
    }
    if (!formData.engagementModel) {
      errors.engagementModel = 'Engagement model is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (isEdit && contractor) {
        const payload = {
          supplierId: formData.supplierId,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          taxNumber: formData.taxNumber.trim() || undefined,
          idNumber: formData.idNumber.trim() || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          taxResidency: formData.nationality.trim() || 'ZA',
          workerClassification: formData.workerClassification,
          engagementModel: formData.engagementModel,
          isActive: formData.status === 'ACTIVE',
        };
        const updated = await api.updateContractor(contractor.id, payload);
        showToast('success', `${EXTERNAL_WORKFORCE_LABELS.worker} updated`);
        onSaved(updated, 'update');
        onClose();
      } else {
        const payload = {
          supplierId: formData.supplierId,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          taxNumber: formData.taxNumber.trim() || undefined,
          idNumber: formData.idNumber.trim() || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          taxResidency: formData.nationality.trim() || 'ZA',
          workerClassification: formData.workerClassification,
          engagementModel: formData.engagementModel,
          sponsorNote: formData.sponsorNote.trim() || undefined,
        };
        const created = await api.createContractor(payload);
        showToast('success', `${EXTERNAL_WORKFORCE_LABELS.worker} added to registry`);
        onSaved(created, 'create');
        onClose();
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to save ${EXTERNAL_WORKFORCE_LABELS.worker}`;
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const modalDescription = isEdit
    ? `Update profile, supplier link, and engagement details for this ${EXTERNAL_WORKFORCE_LABELS.worker}.`
    : `Register a ${EXTERNAL_WORKFORCE_LABELS.worker} directly in the operational registry. Assign a ${INTERNAL_ACCOUNTABILITY_LABELS.role.toLowerCase()} later from Workforce Discovery if needed.`;

  const selectedSupplier = suppliers.find((s) => s.id === formData.supplierId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? EXTERNAL_WORKFORCE_LABELS.editWorker : EXTERNAL_WORKFORCE_LABELS.addWorker}
      description={modalDescription}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection
          title="Supplier & identity"
          description="Link the worker to a supplier and capture legal identity."
          first
        >
          <FormSelect
            label="Supplier"
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            options={suppliers.map((s) => ({
              value: s.id,
              label: supplierSelectLabel({
                name: formatSupplierDisplayName(s),
                status: s.status ?? 'PENDING_APPROVAL',
                externalSupplierId: s.externalSupplierId,
              }),
            }))}
            error={formErrors.supplierId}
            required
          />
          {selectedSupplier?.status && !isOperationalTrustGranted(selectedSupplier.status) ? (
            <OperationalTrustWorkerBlock
              supplierName={formatSupplierDisplayName(selectedSupplier)}
              supplierStatus={selectedSupplier.status}
              variant="form"
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </FormSection>

        <FormSection title="Contact" description="Primary contact details for operations.">
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
            placeholder="+27821234567"
            helperText="Optional — include country code"
          />
        </FormSection>

        <FormSection
          title="Tax & compliance"
          description="Used for payroll, tax reporting, and jurisdiction checks."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="Tax number"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
            />
            <FormInput
              label="ID number"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="Date of birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />
            <FormInput
              label="Tax residency (country code)"
              value={formData.nationality}
              onChange={(e) =>
                setFormData({ ...formData, nationality: e.target.value.toUpperCase() })
              }
              placeholder="ZA"
              helperText="e.g. ZA for South Africa"
            />
          </div>
        </FormSection>

        <FormSection
          title="Engagement"
          description="How this worker is classified and engaged with the organization."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormSelect
              label="Worker classification"
              value={formData.workerClassification}
              onChange={(e) =>
                setFormData({ ...formData, workerClassification: e.target.value })
              }
              options={WORKER_CLASSIFICATION_OPTIONS}
              error={formErrors.workerClassification}
              required
            />
            <FormSelect
              label="Engagement model"
              value={formData.engagementModel}
              onChange={(e) => setFormData({ ...formData, engagementModel: e.target.value })}
              options={[
                { value: 'DIRECT', label: 'Direct' },
                { value: 'AGENCY', label: 'Agency' },
              ]}
              error={formErrors.engagementModel}
              required
            />
          </div>
          {formData.supplierId && !isEdit ? (
            <p className="text-xs text-content-muted">
              Vendor-linked workers are usually classified as Supplier contractor.
            </p>
          ) : null}
        </FormSection>

        {!isEdit ? (
          <FormSection
            title="Governance context"
            description={`Optional note for audit — e.g. pending ${INTERNAL_ACCOUNTABILITY_LABELS.role.toLowerCase()} assignment.`}
          >
            <FormTextarea
              label="Governance note (optional)"
              value={formData.sponsorNote}
              onChange={(e) => setFormData({ ...formData, sponsorNote: e.target.value })}
              placeholder={`Capture optional ${INTERNAL_ACCOUNTABILITY_LABELS.role.toLowerCase()} or governance context at creation…`}
              className="min-h-[88px]"
            />
          </FormSection>
        ) : null}

        {isEdit ? (
          <FormSection title="Lifecycle">
            <FormSelect
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              required
            />
          </FormSection>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-card-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEdit
              ? `Update ${EXTERNAL_WORKFORCE_LABELS.worker}`
              : EXTERNAL_WORKFORCE_LABELS.addWorker}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
