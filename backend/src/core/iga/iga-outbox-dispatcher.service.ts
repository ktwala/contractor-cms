import { Inject, Injectable } from '@nestjs/common';
import { IgaOutboxDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  IGA_DELIVERY_PROVIDER,
  type IgaDeliveryProvider,
} from './iga-delivery-provider.interface';
import type { IgaOutboundExternalWorkforceEventV1 } from './iga-event.types';

export interface IgaOutboxDispatchResult {
  processed: number;
  sent: number;
  failed: number;
}

/**
 * PR-IGA-DISPATCHER-1 — single-pass poll of PENDING outbox rows; transport via delivery adapter only.
 * Outbox is source of truth. Does not provision, certify, or act as IGA (see ADR-EXTID-001 §6.1).
 */
@Injectable()
export class IgaOutboxDispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IGA_DELIVERY_PROVIDER)
    private readonly deliveryProvider: IgaDeliveryProvider,
  ) {}

  /**
   * Fetch up to `limit` oldest PENDING events, attempt delivery, update status.
   * Outbox persistence remains source of truth.
   */
  async processPending(limit = 25): Promise<IgaOutboxDispatchResult> {
    const rows = await this.prisma.igaOutboxEvent.findMany({
      where: { deliveryStatus: IgaOutboxDeliveryStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await this.deliveryProvider.deliver({
          outboxId: row.id,
          eventType: row.eventType,
          eventVersion: row.eventVersion,
          source: row.source,
          externalPersonId: row.externalPersonId,
          payload: row.payloadJson as unknown as IgaOutboundExternalWorkforceEventV1,
        });
        await this.prisma.igaOutboxEvent.update({
          where: { id: row.id },
          data: { deliveryStatus: IgaOutboxDeliveryStatus.SENT },
        });
        sent += 1;
      } catch {
        await this.prisma.igaOutboxEvent.update({
          where: { id: row.id },
          data: {
            deliveryStatus: IgaOutboxDeliveryStatus.FAILED,
            lastAttemptAt: new Date(),
          },
        });
        failed += 1;
      }
    }

    return { processed: rows.length, sent, failed };
  }
}
