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
    supplier = await DataFactory.createSupplier(TestHelper.getPrisma(), {
      organizationId: org.id,
    });
    contractor = await TestHelper.getPrisma().contractor.create({
      data: {
        organization: { connect: { id: org.id } },
        supplier: { connect: { id: supplier.id } },
        firstName: 'Jane',
        lastName: 'Contractor',
        email: `contractor-${Date.now()}@example.com`,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
        dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      },
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
        responsibleManagerEmployeeId: 'cms:sponsor:emp:alpha',
        responsibleManagerDelegateEmployeeId: 'cms:sponsor:delegate:beta',
        responsibleManagerStatus: 'RESPONSIBLE_MANAGER_ACTIVE',
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.responsibleManagerEmployeeId).toBe('cms:sponsor:emp:alpha');
    expect(res.body.responsibleManagerDelegateEmployeeId).toBe('cms:sponsor:delegate:beta');
    expect(res.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ACTIVE');
  });

  it('POST /engagements responsibleManagerEmployeeId only => responsibleManagerStatus defaults to RESPONSIBLE_MANAGER_ASSIGNED', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        responsibleManagerEmployeeId: 'emp-only',
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.responsibleManagerEmployeeId).toBe('emp-only');
    expect(res.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ASSIGNED');
  });

  it('POST /engagements responsibleManagerStatus without responsibleManagerEmployeeId => 400', async () => {
    await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        responsibleManagerStatus: 'RESPONSIBLE_MANAGER_ACTIVE',
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('POST /engagements without sponsor fields => 201 (nulls / omitted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    expect(res.body.responsibleManagerEmployeeId ?? null).toBeNull();
    expect(res.body.responsibleManagerDelegateEmployeeId ?? null).toBeNull();
    expect(res.body.responsibleManagerStatus ?? null).toBeNull();
  });

  it('POST /engagements with explicit null sponsor fields => 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        responsibleManagerEmployeeId: null,
        responsibleManagerDelegateEmployeeId: null,
        responsibleManagerStatus: null,
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.responsibleManagerEmployeeId ?? null).toBeNull();
    expect(res.body.responsibleManagerDelegateEmployeeId ?? null).toBeNull();
    expect(res.body.responsibleManagerStatus ?? null).toBeNull();
  });

  it('PATCH /engagements/:id updates sponsor fields => 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        responsibleManagerEmployeeId: 'initial',
        responsibleManagerStatus: 'RESPONSIBLE_MANAGER_ACTIVE',
      })
      .expect(HttpStatus.CREATED);

    expect(created.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ACTIVE');

    const res = await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        responsibleManagerEmployeeId: 'cms:sponsor:emp:updated',
        responsibleManagerDelegateEmployeeId: 'cms:sponsor:delegate:updated',
        responsibleManagerStatus: 'RESPONSIBLE_MANAGER_TRANSFER_PENDING',
      })
      .expect(HttpStatus.OK);

    expect(res.body.responsibleManagerEmployeeId).toBe('cms:sponsor:emp:updated');
    expect(res.body.responsibleManagerDelegateEmployeeId).toBe('cms:sponsor:delegate:updated');
    expect(res.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_TRANSFER_PENDING');
  });

  it('PATCH /engagements/:id responsibleManagerEmployeeId only on unsponsored row => RESPONSIBLE_MANAGER_ASSIGNED', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    const res = await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ responsibleManagerEmployeeId: 'patch-emp-only' })
      .expect(HttpStatus.OK);

    expect(res.body.responsibleManagerEmployeeId).toBe('patch-emp-only');
    expect(res.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ASSIGNED');
  });

  it('PATCH /engagements/:id responsibleManagerStatus without primary sponsor => 400', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(baseCreateBody())
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .patch(`/engagements/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ responsibleManagerStatus: 'RESPONSIBLE_MANAGER_ACTIVE' })
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
        responsibleManagerEmployeeId: 'cms:sponsor:emp:evil',
        responsibleManagerStatus: 'RESPONSIBLE_MANAGER_ACTIVE',
      })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('CONTRACTOR cannot PATCH engagements sponsor fields', async () => {
    const created = await request(app.getHttpServer())
      .post('/engagements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ...baseCreateBody(),
        responsibleManagerEmployeeId: 'mgr-owned',
      })
      .expect(HttpStatus.CREATED);

    expect(created.body.responsibleManagerStatus).toBe('RESPONSIBLE_MANAGER_ASSIGNED');

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
      .send({ responsibleManagerEmployeeId: 'hijack' })
      .expect(HttpStatus.FORBIDDEN);
  });
});
