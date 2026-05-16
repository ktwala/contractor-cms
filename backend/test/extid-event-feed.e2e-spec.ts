import { INestApplication } from '@nestjs/common';
import { IgaOutboxDeliveryStatus } from '@prisma/client';
import request from 'supertest';
import { ApiKeyService } from '../src/core/auth/services/api-key.service';
import { TestHelper } from './utils/test-helper';

describe('EXTID Event Feed (PR-EXTID-EVENT-FEED-1) E2E', () => {
  let app: INestApplication;
  let organization: { id: string };
  let user: { id: string };
  let apiKeyService: ApiKeyService;
  let integrationKey: string;

  const extidScopes = [
    'extid-events:read',
    'extid-events:ack',
    'extid-events:fail',
  ];

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
    apiKeyService = app.get(ApiKeyService);
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    organization = await TestHelper.createTestOrganization();
    user = await TestHelper.createTestUser(organization.id, {
      email: 'extid-admin@test.com',
    });

    const { apiKey } = await apiKeyService.generateApiKey({
      name: 'IGA integration test',
      scopes: extidScopes,
      organizationId: organization.id,
      createdBy: user.id,
    });
    integrationKey = apiKey;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  async function seedPendingEvent(organizationId: string) {
    return TestHelper.getPrisma().igaOutboxEvent.create({
      data: {
        organizationId,
        eventType: 'EXTERNAL_PERSON_CREATED',
        eventVersion: 1,
        source: 'contractor-cms',
        externalPersonId: 'ext-person-1',
        payloadJson: {
          eventType: 'EXTERNAL_PERSON_CREATED',
          version: 1,
          source: 'contractor-cms',
          externalPersonId: 'ext-person-1',
        },
        deliveryStatus: IgaOutboxDeliveryStatus.PENDING,
      },
    });
  }

  it('lists pending events for org-scoped API key', async () => {
    const event = await seedPendingEvent(organization.id);

    const response = await request(app.getHttpServer())
      .get('/extid/events')
      .set('X-API-Key', integrationKey)
      .query({ status: 'PENDING', limit: 50 })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(event.id);
    expect(response.body.items[0].payload).toMatchObject({
      eventType: 'EXTERNAL_PERSON_CREATED',
    });
  });

  it('reads, acknowledges, and fails events via integration API', async () => {
    const event = await seedPendingEvent(organization.id);

    await request(app.getHttpServer())
      .get(`/extid/events/${event.id}`)
      .set('X-API-Key', integrationKey)
      .expect(200)
      .expect((res) => {
        expect(res.body.deliveryStatus).toBe('PENDING');
      });

    const ack = await request(app.getHttpServer())
      .post(`/extid/events/${event.id}/ack`)
      .set('X-API-Key', integrationKey)
      .expect(201);

    expect(ack.body.deliveryStatus).toBe('SENT');

    const ackAgain = await request(app.getHttpServer())
      .post(`/extid/events/${event.id}/ack`)
      .set('X-API-Key', integrationKey)
      .expect(201);

    expect(ackAgain.body.deliveryStatus).toBe('SENT');

    const other = await seedPendingEvent(organization.id);

    const failed = await request(app.getHttpServer())
      .post(`/extid/events/${other.id}/fail`)
      .set('X-API-Key', integrationKey)
      .send({ reason: 'Soffid rejected payload' })
      .expect(201);

    expect(failed.body.deliveryStatus).toBe('FAILED');
    expect(failed.body.failureReason).toBe('Soffid rejected payload');
  });

  it('rejects requests without integration scopes', async () => {
    const { apiKey } = await apiKeyService.generateApiKey({
      name: 'read-only',
      scopes: ['extid-events:read'],
      organizationId: organization.id,
      createdBy: user.id,
    });

    const event = await seedPendingEvent(organization.id);

    await request(app.getHttpServer())
      .post(`/extid/events/${event.id}/ack`)
      .set('X-API-Key', apiKey)
      .expect(403);
  });
});
