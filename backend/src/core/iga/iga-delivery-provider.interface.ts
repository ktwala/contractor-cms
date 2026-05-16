import type { IgaOutboundExternalWorkforceEventV1 } from './iga-event.types';

/** Outbox row slice passed to a delivery provider (transport only — outbox remains source of truth). */
export interface IgaOutboxDeliveryInput {
  outboxId: string;
  eventType: string;
  eventVersion: number;
  source: string;
  externalPersonId: string | null;
  payload: IgaOutboundExternalWorkforceEventV1;
}

/**
 * PR-IGA-DISPATCHER-1 — pluggable outbound delivery (stub / future Soffid connector).
 * Must not mutate workforce state; transport acknowledgment only.
 */
export interface IgaDeliveryProvider {
  deliver(input: IgaOutboxDeliveryInput): Promise<void>;
}

export const IGA_DELIVERY_PROVIDER = Symbol('IGA_DELIVERY_PROVIDER');
