import { INestApplication } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  ContractorSourceSyncRunStatus,
  HcmContractorCorrelationMatchStatus,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

describe('Oracle HCM contractor connector (PR-CTR-CONNECTOR-1A–1C)', () => {
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
      email: 'hcm.connector@test.com',
      password: 'HcmConnector123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS, 'contractor-remediation:manage'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'hcm.connector@test.com',
      'HcmConnector123!',
    );

    return { org, token };
  }

  it('POST import creates sync run and replay-safe staging with correlation', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();

    const content = JSON.stringify([
      {
        person_id: 'HCM-CONN-001',
        person_number: 'PN-001',
        email: 'hcm.worker@test.com',
        display_name: 'HCM Worker',
        worker_type: 'CWK',
      },
    ]);

    const res = await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', content })
      .expect(201);

    expect(res.body.syncRunId).toBeDefined();
    expect(res.body.status).toBe(ContractorSourceSyncRunStatus.SUCCEEDED);

    const staging = await prisma.hcmContractorStaging.findUnique({
      where: {
        organizationId_sourceSystem_sourcePersonId: {
          organizationId: org.id,
          sourceSystem: 'ORACLE_HCM',
          sourcePersonId: 'HCM-CONN-001',
        },
      },
    });
    expect(staging?.contractorSourceSyncRunId).toBe(res.body.syncRunId);
    expect(staging?.correlationMatchStatus).toBe(HcmContractorCorrelationMatchStatus.NEW);

    const replay = await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', content })
      .expect(201);

    const count = await prisma.hcmContractorStaging.count({
      where: { organizationId: org.id, sourcePersonId: 'HCM-CONN-001' },
    });
    expect(count).toBe(1);
    expect(replay.body.syncRunId).not.toBe(res.body.syncRunId);
  });

  it('GET health returns DISABLED when REST is off', async () => {
    const { token } = await setupHcmTenant();

    const res = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.restEnabled).toBe(false);
    expect(res.body.health).toBe('DISABLED');
  });

  it('failed sync does not advance HCM checkpoint', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();

    const before = new Date('2020-01-01T00:00:00.000Z');
    await prisma.organization.update({
      where: { id: org.id },
      data: { oracleHcmLastSuccessfulSyncAt: before },
    });

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/sync')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.oracleHcmLastSuccessfulSyncAt?.toISOString()).toBe(
      before.toISOString(),
    );
  });
});
