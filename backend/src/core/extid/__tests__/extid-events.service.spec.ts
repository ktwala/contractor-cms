import { ConflictException, NotFoundException } from '@nestjs/common';
import { IgaOutboxDeliveryStatus } from '@prisma/client';
import { ExtidEventsService } from '../extid-events.service';
import { AuditService } from '../../audit/audit.service';

describe('ExtidEventsService (PR-EXTID-EVENT-FEED-1)', () => {
  let service: ExtidEventsService;
  let prisma: {
    igaOutboxEvent: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { logAction: jest.Mock };

  const actor = { kind: 'api_key' as const, apiKeyId: 'key-1', organizationScope: 'org-1' };
  const requestMeta = { ip: '127.0.0.1', userAgent: 'test' };

  const baseRow = {
    id: 'evt-1',
    organizationId: 'org-1',
    eventType: 'EXTERNAL_PERSON_CREATED',
    eventVersion: 1,
    source: 'contractor-cms',
    externalPersonId: 'ext-1',
    payloadJson: { eventType: 'EXTERNAL_PERSON_CREATED', version: 1 },
    deliveryStatus: IgaOutboxDeliveryStatus.PENDING,
    failureReason: null,
    createdAt: new Date('2026-05-16T10:00:00.000Z'),
    lastAttemptAt: null,
  };

  beforeEach(() => {
    prisma = {
      igaOutboxEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { logAction: jest.fn().mockResolvedValue(undefined) };
    service = new ExtidEventsService(prisma as any, audit as unknown as AuditService);
  });

  it('lists pending events scoped to organization', async () => {
    prisma.igaOutboxEvent.findMany.mockResolvedValue([baseRow]);

    const result = await service.listEvents(
      'org-1',
      { status: IgaOutboxDeliveryStatus.PENDING, limit: 50 },
      actor,
      requestMeta,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].payload).toEqual(baseRow.payloadJson);
    expect(prisma.igaOutboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryStatus: IgaOutboxDeliveryStatus.PENDING,
          organizationId: 'org-1',
        }),
      }),
    );
    expect(audit.logAction).toHaveBeenCalledWith(
      null,
      'EXTID_EVENTS_LISTED',
      'ExtidEventFeed',
      'list',
      null,
      null,
      expect.any(Object),
    );
  });

  it('acknowledges a pending event to SENT', async () => {
    prisma.igaOutboxEvent.findUnique.mockResolvedValue(baseRow);
    prisma.igaOutboxEvent.update.mockResolvedValue({
      ...baseRow,
      deliveryStatus: IgaOutboxDeliveryStatus.SENT,
      lastAttemptAt: new Date('2026-05-16T11:00:00.000Z'),
    });

    const result = await service.acknowledgeEvent('org-1', 'evt-1', actor, requestMeta);

    expect(result.deliveryStatus).toBe(IgaOutboxDeliveryStatus.SENT);
    expect(prisma.igaOutboxEvent.update).toHaveBeenCalled();
  });

  it('rejects ack when event is FAILED', async () => {
    prisma.igaOutboxEvent.findUnique.mockResolvedValue({
      ...baseRow,
      deliveryStatus: IgaOutboxDeliveryStatus.FAILED,
    });

    await expect(
      service.acknowledgeEvent('org-1', 'evt-1', actor, requestMeta),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks event failed with reason', async () => {
    prisma.igaOutboxEvent.findUnique.mockResolvedValue(baseRow);
    prisma.igaOutboxEvent.update.mockResolvedValue({
      ...baseRow,
      deliveryStatus: IgaOutboxDeliveryStatus.FAILED,
      failureReason: 'Soffid timeout',
    });

    const result = await service.failEvent(
      'org-1',
      'evt-1',
      'Soffid timeout',
      actor,
      requestMeta,
    );

    expect(result.deliveryStatus).toBe(IgaOutboxDeliveryStatus.FAILED);
    expect(result.failureReason).toBe('Soffid timeout');
  });

  it('hides events outside organization scope', async () => {
    prisma.igaOutboxEvent.findUnique.mockResolvedValue({
      ...baseRow,
      organizationId: 'org-other',
    });

    await expect(
      service.getEvent('org-1', 'evt-1', actor, requestMeta),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
