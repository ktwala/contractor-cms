import {
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
} from '@prisma/client';

export const OPEN_CONTRACTOR_DRIFT_STATUSES: ContractorSourceDriftStatus[] = [
  ContractorSourceDriftStatus.DETECTED,
  ContractorSourceDriftStatus.CLASSIFIED,
  ContractorSourceDriftStatus.UNDER_REVIEW,
];

/** Critical workforce drifts unresolved beyond this window surface in ops aging panels. */
export const CRITICAL_WORKFORCE_DRIFT_AGE_HOURS = 24;

export function buildContractorDriftFingerprint(input: {
  organizationId: string;
  driftType: ContractorSourceDriftType;
  contractorId?: string | null;
  sourcePersonId?: string | null;
  stagingId?: string | null;
}): string {
  return [
    input.organizationId,
    input.driftType,
    input.contractorId ?? '',
    input.sourcePersonId ?? '',
    input.stagingId ?? '',
  ].join(':');
}
