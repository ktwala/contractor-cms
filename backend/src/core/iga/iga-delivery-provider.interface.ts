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
 * PR-IGA-DISPATCHER-1 / planned PR-EXTID-EVENT-DELIVERY-1 — outbound **delivery adapter** only.
 * CMS publishes events; IGA (e.g. Soffid) consumes and executes governance — CMS is not IGA.
 * Must not provision, certify, map entitlements, or mutate workforce state in CMS.
 */
export interface IgaDeliveryProvider {
  deliver(input: IgaOutboxDeliveryInput): Promise<void>;
}

export const IGA_DELIVERY_PROVIDER = Symbol('IGA_DELIVERY_PROVIDER');
