import { INestApplication } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  ContractorSourceDriftSeverity,
  ContractorSourceDriftType,
  MigrationSourceSystem,
  SupplierType,
  WorkerClassification,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Oracle HCM contractor drift (PR-CTR-CONNECTOR-1F)', () => {
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

    const user = await TestHelper.createUserWithRoles(org.id, {
      email: 'hcm.drift@test.com',
      password: 'HcmDrift123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['contractor-migration:read', 'contractor-migration:manage'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('hcm.drift@test.com', 'HcmDrift123!');
    return { org, token, userId: user.id };
  }

  async function seedSuccessfulDiscoveryRun(orgId: string) {
    const prisma = TestHelper.getPrisma();
    return prisma.contractorSourceSyncRun.create({
      data: {
        organizationId: orgId,
        status: 'SUCCEEDED',
        mode: 'INCREMENTAL',
        startedAt: new Date(),
        finishedAt: new Date(),
        importedCount: 1,
        matchedCount: 1,
        newCount: 0,
        correlationFailures: 0,
        failedCount: 0,
      },
    });
  }

  it('POST drift/detect registers GOVERNANCE_LIFECYCLE_CONFLICT without deactivating contractor', async () => {
    const { org, token } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();
    await seedSuccessfulDiscoveryRun(org.id);

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Drift Supplier',
        email: `drift-sup-${Date.now()}@test.com`,
        country: 'ZA',
      },
    });

    const contractor = await prisma.contractor.create({
      data: {
        organization: { connect: { id: org.id } },
        supplier: { connect: { id: supplier.id } },
        firstName: 'Active',
        lastName: 'Worker',
        email: 'drift.worker@test.com',
        workerClassification: WorkerClassification.INDEPENDENT_CONTRACTOR,
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        isActive: true,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: 'HCM-DRIFT-001',
      },
    });

    await prisma.hcmContractorStaging.create({
      data: {
        organizationId: org.id,
        sourcePersonId: 'HCM-DRIFT-001',
        sourcePayloadJson: { person_id: 'HCM-DRIFT-001', status: 'terminated' },
        sourceHash: 'hash-drift-1',
        normalizedPayloadJson: {
          sourcePersonId: 'HCM-DRIFT-001',
          assignmentStatus: 'terminated',
          supplier: supplier.companyName,
          workerType: 'CWK',
        },
        proposedContractorId: contractor.id,
        correlationMatchStatus: 'MATCHED',
        correlationConfidence: 'HIGH',
      },
    });

    const detect = await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(detect.body.detected).toBeGreaterThan(0);

    const drift = await prisma.contractorSourceDrift.findFirst({
      where: {
        organizationId: org.id,
        driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
      },
    });
    expect(drift?.severity).toBe(ContractorSourceDriftSeverity.CRITICAL);
    expect(drift?.contractorId).toBe(contractor.id);

    const unchanged = await prisma.contractor.findUnique({ where: { id: contractor.id } });
    expect(unchanged?.isActive).toBe(true);
  });

  it('POST drift/:id/assign and resolve closes workflow', async () => {
    const { org, token, userId } = await setupHcmTenant();
    const prisma = TestHelper.getPrisma();
    await seedSuccessfulDiscoveryRun(org.id);

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Resolve Supplier',
        email: `resolve-sup-${Date.now()}@test.com`,
        country: 'ZA',
      },
    });

    const contractor = await prisma.contractor.create({
      data: {
        organization: { connect: { id: org.id } },
        supplier: { connect: { id: supplier.id } },
        firstName: 'Resolve',
        lastName: 'Worker',
        email: 'resolve.worker@test.com',
        workerClassification: WorkerClassification.INDEPENDENT_CONTRACTOR,
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        isActive: true,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: 'HCM-DRIFT-002',
      },
    });

    await prisma.hcmContractorStaging.create({
      data: {
        organizationId: org.id,
        sourcePersonId: 'HCM-DRIFT-002',
        sourcePayloadJson: { status: 'terminated' },
        sourceHash: 'hash-drift-2',
        normalizedPayloadJson: { assignmentStatus: 'terminated', supplier: 'x' },
        proposedContractorId: contractor.id,
        correlationMatchStatus: 'MATCHED',
      },
    });

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const drift = await prisma.contractorSourceDrift.findFirst({
      where: { organizationId: org.id },
    });
    expect(drift).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/contractor-sources/oracle-hcm/drift/${drift!.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: userId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/contractor-sources/oracle-hcm/drift/${drift!.id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolutionNotes: 'Access review scheduled — manual deprovision tracked' })
      .expect(201);

    const resolved = await prisma.contractorSourceDrift.findUnique({
      where: { id: drift!.id },
    });
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.assignedToUserId).toBe(userId);
  });

  it('GET dashboard includes drift summary', async () => {
    const { token } = await setupHcmTenant();

    const dashboard = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.driftSummary).toBeDefined();
    expect(dashboard.body.driftSummary.openTotal).toBeDefined();
    expect(dashboard.body.workforceAssessment).toBeDefined();
    expect(dashboard.body.workforceAssessment.lifecyclePhase).toBe('DISCOVERY_PENDING');
  });

  it('POST drift/detect rejects repeat assessment for the same discovery snapshot', async () => {
    const { org, token } = await setupHcmTenant();
    await seedSuccessfulDiscoveryRun(org.id);

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
