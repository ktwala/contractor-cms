import { WorkerClassification } from '@prisma/client';

/** Display order for CMS contractor forms (registry requires explicit choice). */
export const WORKER_CLASSIFICATION_OPTIONS: Array<{
  value: WorkerClassification;
  label: string;
}> = [
  { value: WorkerClassification.SUPPLIER_CONTRACTOR, label: 'Supplier Contractor' },
  { value: WorkerClassification.INDEPENDENT_CONTRACTOR, label: 'Independent Contractor' },
  { value: WorkerClassification.CONSULTANT, label: 'Consultant' },
  { value: WorkerClassification.TEMPORARY_WORKER, label: 'Temporary Worker' },
  { value: WorkerClassification.PROFESSIONAL_SERVICES, label: 'Professional Services' },
  { value: WorkerClassification.OTHER, label: 'Other' },
];

/** HCM bootstrap materialization — vendor-linked workforce default. */
export const HCM_BOOTSTRAP_WORKER_CLASSIFICATION =
  WorkerClassification.SUPPLIER_CONTRACTOR;
