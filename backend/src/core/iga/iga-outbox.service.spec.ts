import { Test } from '@nestjs/testing';
import { IgaOutboxDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IgaOutboundExternalWorkforceEventV1 } from './iga-event.types';
import { IgaOutboxService } from './iga-outbox.service';

describe('IgaOutboxService', () => {
  let service: IgaOutboxService;
  let createMock: jest.Mock;

  const sampleEvent: IgaOutboundExternalWorkforceEventV1 = {
    version: 1,
    source: 'contractor-cms',
    eventId: 'evt-1',
    eventType: 'EXTERNAL_PERSON_CREATED',
    occurredAt: '2026-05-15T12:00:00.000Z',
    externalPersonId: 'ext-1',
    contractorId: 'c-1',
    engagementId: null,
    personType: 'PERSON_SUPPLIED_WORKER',
    workerArchetype: 'ARCHETYPE_SUPPLIED',
    supplierId: 's-1',
    sponsorEmployeeId: null,
    sponsorStatus: null,
    accessIntent: 'ACCESS_LOGICAL',
    riskTier: 'RISK_LOW',
    igaIntegrationStatus: 'IGA_UNKNOWN',
  };

  beforeEach(async () => {
    createMock = jest.fn().mockResolvedValue({ id: 'outbox-row-1' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        IgaOutboxService,
        {
          provide: PrismaService,
          useValue: {
            igaOutboxEvent: { create: createMock },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(IgaOutboxService);
  });

  it('save stores event with PENDING deliveryStatus', async () => {
    await service.save(sampleEvent);

    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as {
      data: {
        deliveryStatus: IgaOutboxDeliveryStatus;
        eventType: string;
        eventVersion: number;
        source: string;
        externalPersonId: string | null;
        payloadJson: unknown;
      };
    };
    expect(arg.data.deliveryStatus).toBe(IgaOutboxDeliveryStatus.PENDING);
    expect(arg.data.eventType).toBe('EXTERNAL_PERSON_CREATED');
    expect(arg.data.eventVersion).toBe(1);
    expect(arg.data.source).toBe('contractor-cms');
    expect(arg.data.externalPersonId).toBe('ext-1');
  });

  it('save preserves full payloadJson for the built event', async () => {
    await service.save(sampleEvent);

    const arg = createMock.mock.calls[0][0] as { data: { payloadJson: unknown } };
    expect(arg.data.payloadJson).toEqual(sampleEvent);
  });
});
