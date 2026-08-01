import {
  IGA_EVENT_CONTRACT_VERSION,
  IGA_EVENT_SOURCE,
} from '../../../core/iga/iga-event.types';

/** CAP-ACCESS-INTEGRATION §6 — acquisition publish intent after Identity Acquisition handoff. */
export const CONTRACTOR_MIGRATED_EVENT_TYPE = 'contractor.migrated' as const;

export interface ContractorMigratedIgaEventV1 {
  version: typeof IGA_EVENT_CONTRACT_VERSION;
  source: typeof IGA_EVENT_SOURCE;
  eventId: string;
  eventType: typeof CONTRACTOR_MIGRATED_EVENT_TYPE;
  occurredAt: string;
  cmsContractorId: string;
  contractorBusinessId: string;
  legacyHcmPersonId: string;
  legacyHcmPersonNumber: string | null;
  responsibleManagerEmployeeId: string;
  engagementId: string;
  migrationBatchId: string;
}

export function buildContractorMigratedIntentEvent(
  input: Omit<
    ContractorMigratedIgaEventV1,
    'version' | 'source' | 'eventId' | 'eventType' | 'occurredAt'
  >,
): ContractorMigratedIgaEventV1 {
  return {
    version: IGA_EVENT_CONTRACT_VERSION,
    source: IGA_EVENT_SOURCE,
    eventId: crypto.randomUUID(),
    eventType: CONTRACTOR_MIGRATED_EVENT_TYPE,
    occurredAt: new Date().toISOString(),
    ...input,
  };
}
