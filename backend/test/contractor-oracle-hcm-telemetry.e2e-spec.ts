import { INestApplication } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  HcmOracleConnectorHealth,
  MigrationSourceSystem,
  SupplierType,
  WorkerClassification,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Oracle HCM connector telemetry (PR-CTR-CONNECTOR-1E)', () => {
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
      email: 'hcm.telemetry@test.com',
      password: 'HcmTelemetry123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['contractor-migration:read', 'contractor-migration:manage'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'hcm.telemetry@test.com',
      'HcmTelemetry123!',
    );

    return { org, token };
  }

  it('GET telemetry hides assessment outputs until workforce assessment is current', async () => {
    const { token } = await setupHcmTenant();

    const content = JSON.stringify([
      {
        person_id: 'HCM-TEL-001',
        email: 'tel.worker@test.com',
        display_name: 'Tel Worker',
        worker_type: 'CWK',
      },
    ]);

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', content })
      .expect(201);

    const telemetry = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(telemetry.body.connector.totalSyncRuns).toBeGreaterThan(0);
    expect(telemetry.body.connector.workersImported).toBeGreaterThan(0);
    expect(telemetry.body.correlation.manualReviewRequired).toBe(0);
    expect(telemetry.body.governance.missingSupplierLinks).toBe(0);
    expect(telemetry.body.operationalWorkforce.operationallyReady).toBe(0);
  });

  it('GET dashboard uses effective health not import optimism', async () => {
    const { token } = await setupHcmTenant();

    const content = JSON.stringify([
      {
        person_id: 'HCM-DASH-001',
        email: 'dash.worker@test.com',
        worker_type: 'CWK',
      },
    ]);

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'json', content })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.connectorHealth.health).toBe(
      HcmOracleConnectorHealth.DISABLED,
    );
    expect(dashboard.body.syncTelemetry).toBeDefined();
    expect(dashboard.body.correlationTelemetry.manualReviewRequired).toBe(0);
    expect(dashboard.body.governanceTelemetry.missingSupplierLinks).toBe(0);
    expect(dashboard.body.operationalWorkforceTelemetry.operationallyReady).toBe(0);
    expect(dashboard.body.recentSyncRuns).toBeDefined();
  });

  it('GET dashboard surfaces terminated-upstream-but-active after workforce assessment', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();

    const syncRun = await prisma.contractorSourceSyncRun.create({
      data: {
        organizationId: org.id,
        status: 'SUCCEEDED',
        mode: 'FULL',
        startedAt: new Date(),
        finishedAt: new Date(),
        importedCount: 1,
      },
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        workforceLastAssessedDiscoveryRunId: syncRun.id,
        workforceLastAssessedAt: new Date(),
      },
    });

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Risk Supplier Ltd',
        email: `risk-supplier-${Date.now()}@test.com`,
        country: 'ZA',
      },
    });

    const contractor = await prisma.contractor.create({
      data: {
        organization: { connect: { id: org.id } },
        supplier: { connect: { id: supplier.id } },
        firstName: 'Risk',
        lastName: 'Worker',
        email: 'risk.active@test.com',
        workerClassification: WorkerClassification.INDEPENDENT_CONTRACTOR,
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        isActive: true,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: 'HCM-RISK-001',
      },
    });

    await prisma.hcmContractorStaging.create({
      data: {
        organizationId: org.id,
        sourcePersonId: 'HCM-RISK-001',
        sourcePayloadJson: { person_id: 'HCM-RISK-001', status: 'terminated' },
        sourceHash: 'hash-risk-1',
        normalizedPayloadJson: {
          sourcePersonId: 'HCM-RISK-001',
          assignmentStatus: 'terminated',
          supplier: supplier.companyName,
        },
        proposedContractorId: contractor.id,
        correlationMatchStatus: 'MATCHED',
        correlationConfidence: 'HIGH',
      },
    });

    const dashboard = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.governanceTelemetry.terminatedUpstreamButActive).toBe(1);
  });
});
