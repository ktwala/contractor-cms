import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IgaOutboxDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListExtidEventsDto } from './dto/list-extid-events.dto';
import type {
  ExtidEventListResponse,
  ExtidEventResponse,
  IntegrationActorContext,
  IntegrationOrganizationScope,
} from './extid-events.types';
import type { IgaOutboundExternalWorkforceEventV1 } from '../iga/iga-event.types';

@Injectable()
export class ExtidEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listEvents(
    organizationScope: IntegrationOrganizationScope,
    dto: ListExtidEventsDto,
    actor: IntegrationActorContext,
    requestMeta: { ip?: string; userAgent?: string },
  ): Promise<ExtidEventListResponse> {
    const limit = dto.limit ?? 50;
    const status = dto.status ?? IgaOutboxDeliveryStatus.PENDING;

    const where: Prisma.IgaOutboxEventWhereInput = {
      deliveryStatus: status,
      ...this.organizationFilter(organizationScope),
    };

    if (dto.cursor) {
      const cursorRow = await this.prisma.igaOutboxEvent.findUnique({
        where: { id: dto.cursor },
        select: { id: true, createdAt: true, organizationId: true },
      });
      if (!cursorRow || !this.isRowVisible(cursorRow.organizationId, organizationScope)) {
        throw new BadRequestException('Invalid cursor');
      }
      where.OR = [
        { createdAt: { gt: cursorRow.createdAt } },
        {
          createdAt: cursorRow.createdAt,
          id: { gt: cursorRow.id },
        },
      ];
    }

    const rows = await this.prisma.igaOutboxEvent.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    await this.auditService.logAction(
      actor.userId ?? null,
      'EXTID_EVENTS_LISTED',
      'ExtidEventFeed',
      'list',
      null,
      null,
      {
        organizationId: organizationScope,
        ipAddress: requestMeta.ip,
        userAgent: requestMeta.userAgent,
        metadata: {
          apiKeyId: actor.apiKeyId ?? null,
          status,
          limit,
          returnedCount: page.length,
          cursor: dto.cursor ?? null,
        },
      },
    );

    return {
      items: page.map((row) => this.toResponse(row)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getEvent(
    organizationScope: IntegrationOrganizationScope,
    id: string,
    actor: IntegrationActorContext,
    requestMeta: { ip?: string; userAgent?: string },
  ): Promise<ExtidEventResponse> {
    const row = await this.findVisibleOrThrow(organizationScope, id);

    await this.auditService.logAction(
      actor.userId ?? null,
      'EXTID_EVENT_READ',
      'IgaOutboxEvent',
      id,
      null,
      null,
      {
        organizationId: row.organizationId,
        ipAddress: requestMeta.ip,
        userAgent: requestMeta.userAgent,
        metadata: { apiKeyId: actor.apiKeyId ?? null },
      },
    );

    return this.toResponse(row);
  }

  async acknowledgeEvent(
    organizationScope: IntegrationOrganizationScope,
    id: string,
    actor: IntegrationActorContext,
    requestMeta: { ip?: string; userAgent?: string },
  ): Promise<ExtidEventResponse> {
    const row = await this.findVisibleOrThrow(organizationScope, id);

    if (row.deliveryStatus === IgaOutboxDeliveryStatus.SENT) {
      return this.toResponse(row);
    }

    if (row.deliveryStatus === IgaOutboxDeliveryStatus.FAILED) {
      throw new ConflictException(
        'Event is in FAILED status and cannot be acknowledged',
      );
    }

    const updated = await this.prisma.igaOutboxEvent.update({
      where: { id },
      data: {
        deliveryStatus: IgaOutboxDeliveryStatus.SENT,
        lastAttemptAt: new Date(),
        failureReason: null,
      },
    });

    await this.auditService.logAction(
      actor.userId ?? null,
      'EXTID_EVENT_ACKED',
      'IgaOutboxEvent',
      id,
      { deliveryStatus: row.deliveryStatus },
      { deliveryStatus: updated.deliveryStatus },
      {
        organizationId: row.organizationId,
        ipAddress: requestMeta.ip,
        userAgent: requestMeta.userAgent,
        metadata: { apiKeyId: actor.apiKeyId ?? null },
      },
    );

    return this.toResponse(updated);
  }

  async failEvent(
    organizationScope: IntegrationOrganizationScope,
    id: string,
    reason: string,
    actor: IntegrationActorContext,
    requestMeta: { ip?: string; userAgent?: string },
  ): Promise<ExtidEventResponse> {
    const row = await this.findVisibleOrThrow(organizationScope, id);

    if (row.deliveryStatus === IgaOutboxDeliveryStatus.SENT) {
      throw new ConflictException(
        'Event is already acknowledged (SENT) and cannot be marked failed',
      );
    }

    const updated = await this.prisma.igaOutboxEvent.update({
      where: { id },
      data: {
        deliveryStatus: IgaOutboxDeliveryStatus.FAILED,
        failureReason: reason,
        lastAttemptAt: new Date(),
      },
    });

    await this.auditService.logAction(
      actor.userId ?? null,
      'EXTID_EVENT_FAILED',
      'IgaOutboxEvent',
      id,
      { deliveryStatus: row.deliveryStatus },
      {
        deliveryStatus: updated.deliveryStatus,
        failureReason: reason,
      },
      {
        organizationId: row.organizationId,
        ipAddress: requestMeta.ip,
        userAgent: requestMeta.userAgent,
        metadata: { apiKeyId: actor.apiKeyId ?? null, reason },
      },
    );

    return this.toResponse(updated);
  }

  private async findVisibleOrThrow(
    organizationScope: IntegrationOrganizationScope,
    id: string,
  ) {
    const row = await this.prisma.igaOutboxEvent.findUnique({ where: { id } });
    if (!row || !this.isRowVisible(row.organizationId, organizationScope)) {
      throw new NotFoundException('Event not found');
    }
    return row;
  }

  private organizationFilter(
    organizationScope: IntegrationOrganizationScope,
  ): Prisma.IgaOutboxEventWhereInput {
    if (organizationScope === null) {
      return {};
    }
    return { organizationId: organizationScope };
  }

  private isRowVisible(
    rowOrganizationId: string | null,
    organizationScope: IntegrationOrganizationScope,
  ): boolean {
    if (organizationScope === null) {
      return true;
    }
    return rowOrganizationId === organizationScope;
  }

  private toResponse(row: {
    id: string;
    organizationId: string | null;
    eventType: string;
    eventVersion: number;
    source: string;
    externalPersonId: string | null;
    payloadJson: unknown;
    deliveryStatus: IgaOutboxDeliveryStatus;
    failureReason: string | null;
    createdAt: Date;
    lastAttemptAt: Date | null;
  }): ExtidEventResponse {
    return {
      id: row.id,
      organizationId: row.organizationId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      source: row.source,
      externalPersonId: row.externalPersonId,
      payload: row.payloadJson as IgaOutboundExternalWorkforceEventV1,
      deliveryStatus: row.deliveryStatus,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    };
  }
}
