import { INestApplication } from '@nestjs/common';
import {
  OracleSupplierConnectorHealth,
  SupplierAuthorityMode,
  SupplierSourceSyncRunStatus,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

describe('Oracle connector telemetry (PR-CMS-CONNECTOR-1F–1G)', () => {
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
      email: 'connector.telemetry@test.com',
      password: 'ConnectorTel123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'connector.telemetry@test.com',
      'ConnectorTel123!',
    );

    return { org, token };
  }

  it('GET telemetry derives counts from sync runs after import', async () => {
    const { token } = await setupOracleTenant();
    const payload = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/oracle-supplier-extract/mock-suppliers.json'),
        'utf-8',
      ),
    );

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const telemetry = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(telemetry.body.connector.totalSyncRuns).toBeGreaterThan(0);
    expect(telemetry.body.connector.successfulSyncRuns).toBeGreaterThan(0);
    expect(telemetry.body.connector.recordsImported).toBeGreaterThan(0);
  });

  it('GET dashboard exposes effective health not optimistic green', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();

    const staleAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        oracleSupplierLastSuccessfulSyncAt: staleAt,
        oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.HEALTHY,
      },
    });

    process.env.ORACLE_PROCUREMENT_REST_ENABLED = 'true';

    const dashboard = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    delete process.env.ORACLE_PROCUREMENT_REST_ENABLED;

    expect(dashboard.body.connectorHealth.health).toBe(
      OracleSupplierConnectorHealth.STALE,
    );
    expect(dashboard.body.connectorHealth.isStale).toBe(true);
    expect(dashboard.body.recentSyncRuns).toBeDefined();
    expect(dashboard.body.anomalies).toBeDefined();
  });

  it('GET sync-runs returns paginated ledger history', async () => {
    const { token } = await setupOracleTenant();

    const res = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/sync-runs?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET anomalies returns structured anomaly list', async () => {
    const { token } = await setupOracleTenant();

    const res = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/anomalies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.anomalies).toBeDefined();
    expect(res.body.totalAnomalyCount).toBeDefined();
  });
});
