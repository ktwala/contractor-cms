import { INestApplication } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceSyncRunStatus,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Oracle connector sync run ledger (PR-CMS-CONNECTOR-1A-C)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  async function setupOracleTenant() {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'connector.oracle@test.com',
      password: 'ConnectorOra123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:update'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'connector.oracle@test.com',
      'ConnectorOra123!',
    );

    return { org, token };
  }

  it('creates SupplierSourceSyncRun on mock import and advances checkpoint', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();

    const payload = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/oracle-supplier-extract/mock-suppliers.json'),
        'utf-8',
      ),
    );

    const res = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body.syncRunId).toBeDefined();
    expect(res.body.syncRunStatus).toBe(SupplierSourceSyncRunStatus.SUCCEEDED);

    const run = await prisma.supplierSourceSyncRun.findUnique({
      where: { id: res.body.syncRunId },
    });
    expect(run?.status).toBe(SupplierSourceSyncRunStatus.SUCCEEDED);
    expect(run?.importedCount).toBeGreaterThan(0);

    const updatedOrg = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(updatedOrg?.oracleSupplierLastSuccessfulSyncAt).not.toBeNull();
  });

  it('replay of same import is idempotent on staging identity', async () => {
    const { token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();

    const payload = {
      suppliers: [
        {
          externalSupplierId: 'ORA-REPLAY-CONNECTOR',
          name: 'Replay Connector Co',
          countryCode: 'ZA',
          taxRegistrationNumber: 'ZA-REPLAY-1',
        },
      ],
    };

    const first = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const stagingCount = await prisma.supplierSourceStaging.count({
      where: { externalSupplierId: 'ORA-REPLAY-CONNECTOR' },
    });
    expect(stagingCount).toBe(1);
    expect(first.body.rows[0].id).toBe(second.body.rows[0].id);
  });

  it('failed incremental sync does not advance last successful checkpoint', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();

    const before = new Date('2020-01-01T00:00:00.000Z');
    await prisma.organization.update({
      where: { id: org.id },
      data: { oracleSupplierLastSuccessfulSyncAt: before },
    });

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/sync')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const after = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(after?.oracleSupplierLastSuccessfulSyncAt?.toISOString()).toBe(
      before.toISOString(),
    );
  });
});
