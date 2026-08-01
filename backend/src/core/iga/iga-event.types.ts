/**
 * PR-IGA-EVENT-CONTRACT-1 — canonical outbound external-workforce event names only.
 * No transport, no connector, no persistence — contract + serialization shape for v1.
 */

export const IGA_EVENT_CONTRACT_VERSION = 1 as const;

/**
 * Legacy wire identifier retained for IGA event compatibility.
 * The product name is External Workforce Platform.
 */
export const IGA_EVENT_SOURCE = 'contractor-cms' as const;

export const IgaEventType = {
  EXTERNAL_PERSON_CREATED: 'EXTERNAL_PERSON_CREATED',
  EXTERNAL_PERSON_UPDATED: 'EXTERNAL_PERSON_UPDATED',
  EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED: 'EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED',
  EXTERNAL_PERSON_RESPONSIBLE_MANAGER_REMOVED: 'EXTERNAL_PERSON_RESPONSIBLE_MANAGER_REMOVED',
  EXTERNAL_PERSON_SUSPENDED: 'EXTERNAL_PERSON_SUSPENDED',
  EXTERNAL_PERSON_TERMINATED: 'EXTERNAL_PERSON_TERMINATED',
} as const;

export type IgaEventType = (typeof IgaEventType)[keyof typeof IgaEventType];

/**
 * Governance-safe, JSON-serializable outbound event (v1).
 * Enum-like Prisma fields are represented as string names or null.
 */
export interface IgaOutboundExternalWorkforceEventV1 {
  version: typeof IGA_EVENT_CONTRACT_VERSION;
  source: typeof IGA_EVENT_SOURCE;
  eventId: string;
  eventType: IgaEventType;
  occurredAt: string;
  externalPersonId: string | null;
  contractorId: string;
  engagementId: string | null;
  personType: string | null;
  workerArchetype: string | null;
  supplierId: string | null;
  responsibleManagerEmployeeId: string | null;
  responsibleManagerStatus: string | null;
  accessIntent: string | null;
  riskTier: string | null;
  igaIntegrationStatus: string;
}
