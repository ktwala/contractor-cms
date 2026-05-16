import { Injectable } from '@nestjs/common';
import type {
  IgaDeliveryProvider,
  IgaOutboxDeliveryInput,
} from './iga-delivery-provider.interface';

/**
 * Default delivery provider — no outbound IGA vendor call.
 * Replace with a real connector in a future PR; outbox rows remain authoritative.
 */
@Injectable()
export class IgaDeliveryProviderStub implements IgaDeliveryProvider {
  async deliver(_input: IgaOutboxDeliveryInput): Promise<void> {
    // Stub: accept all events; no webhook / bus / Soffid API.
  }
}
