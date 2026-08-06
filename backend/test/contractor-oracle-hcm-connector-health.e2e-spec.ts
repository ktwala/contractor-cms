import { INestApplication } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  HcmOracleConnectorHealth,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

describe('Oracle HCM connector health (PR-CTR-CONNECTOR-1D)', () => {
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

  async function setupHcmTenant() {
    const org = await TestHelper.createTestOrganization({
      contractorAuthorityMode: ContractorAuthorityMode.HCM_ONLY,
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'hcm.health@test.com',
      password: 'HcmHealth123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS, 'contractor-remediation:manage'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('hcm.health@test.com', 'HcmHealth123!');
    return { org, token };
  }

  it('GET /contractor-sources/oracle-hcm/health returns DISABLED when REST is off', async () => {
    const { org, token } = await setupHcmTenant();

    const res = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.organizationId).toBe(org.id);
    expect(res.body.health).toBe(HcmOracleConnectorHealth.DISABLED);
    expect(res.body.restEnabled).toBe(false);
    expect(res.body.evaluatedAt).toBeDefined();
  });

  it('failed incremental sync updates health and last error without advancing checkpoint', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();

    const before = new Date('2020-01-01T00:00:00.000Z');
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        oracleHcmLastSuccessfulSyncAt: before,
        oracleHcmConnectorHealth: HcmOracleConnectorHealth.HEALTHY,
        oracleHcmConnectorLastError: null,
      },
    });

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/sync')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.oracleHcmLastSuccessfulSyncAt?.toISOString()).toBe(
      before.toISOString(),
    );
    expect(after?.oracleHcmConnectorHealth).toBe(HcmOracleConnectorHealth.DISABLED);
    expect(after?.oracleHcmConnectorLastError).toContain('disabled');
  });

  it('file import does not mark REST connector HEALTHY or advance REST checkpoint', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        oracleHcmConnectorHealth: HcmOracleConnectorHealth.UNKNOWN,
        oracleHcmLastSuccessfulSyncAt: null,
        oracleHcmConnectorLastError: null,
      },
    });

    const content = JSON.stringify([
      {
        person_id: 'HCM-HEALTH-001',
        person_number: 'PN-H-001',
        email: 'health.worker@test.com',
        display_name: 'Health Worker',
        worker_type: 'CWK',
      },
    ]);

    const res = await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', content })
      .expect(201);

    expect(res.body.connectorHealth).toBe(HcmOracleConnectorHealth.DISABLED);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.oracleHcmConnectorHealth).toBe(HcmOracleConnectorHealth.UNKNOWN);
    expect(after?.oracleHcmLastSuccessfulSyncAt).toBeNull();
    expect(after?.oracleHcmConnectorLastError).toBeNull();
  });

});
