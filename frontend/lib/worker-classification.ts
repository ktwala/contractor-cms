/** Mirrors `WorkerClassification` enum — keep in sync with Prisma schema. */

export const WORKER_CLASSIFICATION_VALUES = [
  'SUPPLIER_CONTRACTOR',
  'INDEPENDENT_CONTRACTOR',
  'CONSULTANT',
  'TEMPORARY_WORKER',
  'PROFESSIONAL_SERVICES',
  'OTHER',
] as const;

export type WorkerClassificationValue = (typeof WORKER_CLASSIFICATION_VALUES)[number];

export const WORKER_CLASSIFICATION_OPTIONS: Array<{
  value: WorkerClassificationValue;
  label: string;
}> = [
  { value: 'SUPPLIER_CONTRACTOR', label: 'Supplier Contractor' },
  { value: 'INDEPENDENT_CONTRACTOR', label: 'Independent Contractor' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'TEMPORARY_WORKER', label: 'Temporary Worker' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional Services' },
  { value: 'OTHER', label: 'Other' },
];

export function formatWorkerClassification(value?: string | null): string {
  if (!value) return '—';
  const match = WORKER_CLASSIFICATION_OPTIONS.find((o) => o.value === value);
  return match?.label ?? value.replace(/_/g, ' ');
}
