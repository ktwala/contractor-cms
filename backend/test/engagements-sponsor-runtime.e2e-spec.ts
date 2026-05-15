import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

/**
 * PR-SPONSOR-RUNTIME-1 — sponsor substrate on engagements (API read/write).
 * PR-SPONSOR-GOVERNANCE-1 — structural accountability baseline (default status, no HCM).
 */
describe('Engagements sponsor substrate (e2e)', () => {
  let app: INestApplication;
  let org: { id: string };
  let supplier: { id: string };
  let contractor: { id: string };
  let contract: { id: string };
  let managerToken: string;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    org = await TestHelper.createTestOrganization({ name: 'Sponsor Org' });
    supplier = await TestHelper.getPrisma().supplier.create({
      data: {
        ...DataFactory.supplier(),
        organization: { connect: { id: org.id } },
      } as any,
    });
    contractor = await TestHelper.getPrisma().contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Jane',
        lastName: 'Contractor',
        email: `contractor-${Date.now()}@example.com`,
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
        dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      } as any,
    });
    contract = await TestHelper.getPrisma().supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: `SC-${Date.now()}`,
        contractType: 'TIME_AND_MATERIALS',
        title: 'Test MSA',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 365),
        status: 'ACTIVE',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'mgr-sponsor@test.com',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          permissions: [
            'engagements:create',
            'engagements:read',
            'engagements:update',
            'contractors:create',
            'contractors:read',
            'contractors:update',
            'contracts:create',
            'contracts:read',
            'contracts:update',
            'suppliers:create',
            'suppliers:read',
            'suppliers:update',
            'timesheets:read',
            'timesheets:approve',
            'tax-classifications:create',
            'tax-classifications:read',
          ],
        },
      ],
    });
    managerToken = (await TestHelper.login('mgr-sponsor@test.com')).token;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  function baseCreateBody() {
    return {
      contractorId: contractor.id,
      contractId: contract.id,
      role: 'Engineer',
      startDate: new Date().toISOString(),
      rateType: 'HOURLY',
      rateAmount: 500,
      currency: 'ZAR',
    };
  }

  it('POST /engagements with sponsor fields => 201 and persists substrate', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: 'cms:sponsor:emp:alpha',
        sponsorDelegateEmployeeId: 'cms:sponsor:delegate:beta',
        sponsorStatus: 'SPONSOR_ACTIVE',
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.sponsorEmployeeId).toBe('cms:sponsor:emp:alpha');
    expect(res.body.sponsorDelegateEmployeeId).toBe('cms:sponsor:delegate:beta');
    expect(res.body.sponsorStatus).toBe('SPONSOR_ACTIVE');
  });

  it('POST /engagements sponsorEmployeeId only => sponsorStatus defaults to SPONSOR_ASSIGNED', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: 'emp-only',
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.sponsorEmployeeId).toBe('emp-only');
    expect(res.body.sponsorStatus).toBe('SPONSOR_ASSIGNED');
  });

  it('POST /engagements sponsorStatus without sponsorEmployeeId => 400', async () => {
    await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorStatus: 'SPONSOR_ACTIVE',
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('POST /engagements without sponsor fields => 201 (nulls / omitted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    expect(res.body.sponsorEmployeeId ?? null).toBeNull();
    expect(res.body.sponsorDelegateEmployeeId ?? null).toBeNull();
    expect(res.body.sponsorStatus ?? null).toBeNull();
  });

  it('POST /engagements with explicit null sponsor fields => 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: null,
        sponsorDelegateEmployeeId: null,
        sponsorStatus: null,
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.sponsorEmployeeId ?? null).toBeNull();
    expect(res.body.sponsorDelegateEmployeeId ?? null).toBeNull();
    expect(res.body.sponsorStatus ?? null).toBeNull();
  });

  it('PATCH /engagements/:id updates sponsor fields => 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: 'initial',
        sponsorStatus: 'SPONSOR_ACTIVE',
      })
      .expect(HttpStatus.CREATED);

    expect(created.body.sponsorStatus).toBe('SPONSOR_ACTIVE');

    const res = await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        sponsorEmployeeId: 'cms:sponsor:emp:updated',
        sponsorDelegateEmployeeId: 'cms:sponsor:delegate:updated',
        sponsorStatus: 'SPONSOR_TRANSFER_PENDING',
      })
      .expect(HttpStatus.OK);

    expect(res.body.sponsorEmployeeId).toBe('cms:sponsor:emp:updated');
    expect(res.body.sponsorDelegateEmployeeId).toBe('cms:sponsor:delegate:updated');
    expect(res.body.sponsorStatus).toBe('SPONSOR_TRANSFER_PENDING');
  });

  it('PATCH /engagements/:id sponsorEmployeeId only on unsponsored row => SPONSOR_ASSIGNED', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    const res = await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ sponsorEmployeeId: 'patch-emp-only' })
      .expect(HttpStatus.OK);

    expect(res.body.sponsorEmployeeId).toBe('patch-emp-only');
    expect(res.body.sponsorStatus).toBe('SPONSOR_ASSIGNED');
  });

  it('PATCH /engagements/:id sponsorStatus without primary sponsor => 400', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ sponsorStatus: 'SPONSOR_ACTIVE' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('CONTRACTOR cannot create engagements (no sponsor powers via substrate)', async () => {
    await TestHelper.createUserWithRoles(org.id, {
      email: 'worker-sponsor@test.com',
      roles: [
        {
          role: 'CONTRACTOR',
          isSystemRole: true,
          permissions: [
            'timesheets:create',
            'timesheets:read',
            'timesheets:update',
            'profile:read',
            'profile:update',
          ],
        },
      ],
    });
    const workerToken = (await TestHelper.login('worker-sponsor@test.com')).token;

    await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: 'cms:sponsor:emp:evil',
        sponsorStatus: 'SPONSOR_ACTIVE',
      })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('CONTRACTOR cannot PATCH engagements sponsor fields', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        sponsorEmployeeId: 'mgr-owned',
      })
      .expect(HttpStatus.CREATED);

    expect(created.body.sponsorStatus).toBe('SPONSOR_ASSIGNED');

    await TestHelper.createUserWithRoles(org.id, {
      email: 'worker-patch@test.com',
      roles: [
        {
          role: 'CONTRACTOR',
          isSystemRole: true,
          permissions: [
            'timesheets:create',
            'timesheets:read',
            'timesheets:update',
            'profile:read',
            'profile:update',
          ],
        },
      ],
    });
    const workerToken = (await TestHelper.login('worker-patch@test.com')).token;

    await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ sponsorEmployeeId: 'hijack' })
      .expect(HttpStatus.FORBIDDEN);
  });
});
