import { INestApplication } from '@nestjs/common';
import {
  OracleSupplierConnectorHealth,
  SupplierAuthorityMode,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Oracle connector health (PR-CMS-CONNECTOR-1D–1E)', () => {
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
      email: 'connector.health@test.com',
      password: 'ConnectorHealth123!',
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
      'connector.health@test.com',
      'ConnectorHealth123!',
    );

    return { org, token };
  }

  it('GET /supplier-sources/oracle/health returns DISABLED when REST is off', async () => {
    const { org, token } = await setupOracleTenant();

    const res = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.organizationId).toBe(org.id);
    expect(res.body.health).toBe(OracleSupplierConnectorHealth.DISABLED);
    expect(res.body.restEnabled).toBe(false);
    expect(res.body.evaluatedAt).toBeDefined();
  });

  it('failed incremental sync updates health and last error without advancing checkpoint', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();

    const before = new Date('2020-01-01T00:00:00.000Z');
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        oracleSupplierLastSuccessfulSyncAt: before,
        oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.HEALTHY,
        oracleSupplierConnectorLastError: null,
      },
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
    expect(after?.oracleSupplierConnectorHealth).toBe(
      OracleSupplierConnectorHealth.DISABLED,
    );
    expect(after?.oracleSupplierConnectorLastError).toContain('disabled');
  });

  it('governance dashboard exposes connector health without implying Oracle is up', async () => {
    const { token } = await setupOracleTenant();

    const res = await request(app.getHttpServer())
      .get('/suppliers/governance-dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.oracleConnectorHealth).toBe(
      OracleSupplierConnectorHealth.DISABLED,
    );
  });
});
