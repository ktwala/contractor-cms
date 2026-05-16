import { Test } from '@nestjs/testing';
import { IgaOutboxDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IGA_DELIVERY_PROVIDER } from './iga-delivery-provider.interface';
import { IgaOutboxDispatcherService } from './iga-outbox-dispatcher.service';

describe('IgaOutboxDispatcherService', () => {
  let dispatcher: IgaOutboxDispatcherService;
  let findMany: jest.Mock;
  let update: jest.Mock;
  let deliver: jest.Mock;

  const pendingRow = (id: string, createdAt: Date) => ({
    id,
    eventType: 'EXTERNAL_PERSON_CREATED',
    eventVersion: 1,
    source: 'contractor-cms',
    externalPersonId: 'ext-1',
    payloadJson: { eventId: 'evt-1', eventType: 'EXTERNAL_PERSON_CREATED' },
    deliveryStatus: IgaOutboxDeliveryStatus.PENDING,
    createdAt,
    lastAttemptAt: null,
  });

  beforeEach(async () => {
    findMany = jest.fn();
    update = jest.fn().mockResolvedValue({});
    deliver = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IgaOutboxDispatcherService,
        {
          provide: PrismaService,
          useValue: {
            igaOutboxEvent: { findMany, update },
          },
        },
        {
          provide: IGA_DELIVERY_PROVIDER,
          useValue: { deliver },
        },
      ],
    }).compile();

    dispatcher = moduleRef.get(IgaOutboxDispatcherService);
  });

  it('marks PENDING event SENT when provider succeeds', async () => {
    const row = pendingRow('out-1', new Date('2026-05-01T00:00:00Z'));
    findMany.mockResolvedValue([row]);

    const result = await dispatcher.processPending();

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ outboxId: 'out-1', eventType: 'EXTERNAL_PERSON_CREATED' }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'out-1' },
      data: { deliveryStatus: IgaOutboxDeliveryStatus.SENT },
    });
  });

  it('marks FAILED and sets lastAttemptAt when provider throws', async () => {
    const row = pendingRow('out-2', new Date('2026-05-01T00:00:00Z'));
    findMany.mockResolvedValue([row]);
    deliver.mockRejectedValue(new Error('transport down'));

    const before = Date.now();
    const result = await dispatcher.processPending();
    const after = Date.now();

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'out-2' },
      data: {
        deliveryStatus: IgaOutboxDeliveryStatus.FAILED,
        lastAttemptAt: expect.any(Date),
      },
    });
    const attemptAt = update.mock.calls[0][0].data.lastAttemptAt as Date;
    expect(attemptAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(attemptAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('fetches only PENDING events ordered oldest first with limit', async () => {
    findMany.mockResolvedValue([]);

    await dispatcher.processPending(10);

    expect(findMany).toHaveBeenCalledWith({
      where: { deliveryStatus: IgaOutboxDeliveryStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  });

  it('processes rows in fetch order (oldest batch from query)', async () => {
    const older = pendingRow('out-old', new Date('2026-05-01T00:00:00Z'));
    const newer = pendingRow('out-new', new Date('2026-05-02T00:00:00Z'));
    findMany.mockResolvedValue([older, newer]);

    await dispatcher.processPending(25);

    expect(deliver.mock.calls[0][0].outboxId).toBe('out-old');
    expect(deliver.mock.calls[1][0].outboxId).toBe('out-new');
  });

  it('respects limit via findMany take', async () => {
    findMany.mockResolvedValue([pendingRow('only', new Date())]);

    const result = await dispatcher.processPending(1);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    expect(result.processed).toBe(1);
  });
});
