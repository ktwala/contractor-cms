import type { IgaOutboxDeliveryStatus } from '@prisma/client';

export interface ExtidEventResponse {
  id: string;
  organizationId: string | null;
  eventType: string;
  eventVersion: number;
  source: string;
  externalPersonId: string | null;
  payload: unknown;
  deliveryStatus: IgaOutboxDeliveryStatus;
  failureReason: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
}

export interface ExtidEventListResponse {
  items: ExtidEventResponse[];
  nextCursor: string | null;
}

export type IntegrationOrganizationScope = string | null;

export interface IntegrationActorContext {
  kind: 'api_key' | 'user';
  userId?: string;
  apiKeyId?: string;
  organizationScope: IntegrationOrganizationScope;
}
