import { Injectable } from '@nestjs/common';
import { IgaOutboxDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { IgaOutboundExternalWorkforceEventV1 } from './iga-event.types';

/**
 * PR-IGA-OUTBOX-1 — persist a fully built v1 outbound event for later dispatch.
 * No dispatcher, retry worker, or connector.
 */
@Injectable()
export class IgaOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    event: IgaOutboundExternalWorkforceEventV1,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const client = tx ?? this.prisma;
    const row = await client.igaOutboxEvent.create({
      data: {
        eventType: event.eventType,
        eventVersion: event.version,
        source: event.source,
        externalPersonId: event.externalPersonId,
        payloadJson: event as unknown as Prisma.InputJsonValue,
        deliveryStatus: IgaOutboxDeliveryStatus.PENDING,
      },
    });
    return { id: row.id };
  }
}
