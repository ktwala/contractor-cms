import { Injectable } from '@nestjs/common';
import type {
  IgaDeliveryProvider,
  IgaOutboxDeliveryInput,
} from './iga-delivery-provider.interface';

/**
 * Default delivery adapter (no-op) — no outbound vendor call.
 * Replace via PR-EXTID-EVENT-DELIVERY-1 (HTTP/webhook/bus); outbox remains source of truth.
 */
@Injectable()
export class IgaDeliveryProviderStub implements IgaDeliveryProvider {
  async deliver(_input: IgaOutboxDeliveryInput): Promise<void> {
    // Stub: accept all events; no webhook / bus / Soffid API.
  }
}
