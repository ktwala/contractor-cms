import { INestApplication } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  ContractorGovernanceRemediationStatus,
  ContractorSourceDriftType,
  MigrationSourceSystem,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Contractor governance remediation (PR-CTR-CONNECTOR-1G)', () => {
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

  async function setupTenant() {
    const org = await TestHelper.createTestOrganization({
      contractorAuthorityMode: ContractorAuthorityMode.HCM_ONLY,
    });

    const user = await TestHelper.createUserWithRoles(org.id, {
      email: 'gov.remediation@test.com',
      password: 'GovRemediation123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['contractor-migration:read', 'contractor-migration:manage'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('gov.remediation@test.com', 'GovRemediation123!');
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

  it('flagship: drift detect creates remediation with PDP restrictions without deactivating contractor', async () => {
    const { org, token } = await setupTenant();
    const prisma = TestHelper.getPrisma();
    await seedSuccessfulDiscoveryRun(org.id);

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Gov Supplier',
        email: `gov-sup-${Date.now()}@test.com`,
        country: 'ZA',
      },
    });

    const contractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Flagship',
        lastName: 'Worker',
        email: 'flagship.worker@test.com',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        isActive: true,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: 'HCM-FLAG-001',
      },
    });

    await prisma.hcmContractorStaging.create({
      data: {
        organizationId: org.id,
        sourcePersonId: 'HCM-FLAG-001',
        sourcePayloadJson: { person_id: 'HCM-FLAG-001', status: 'terminated' },
        sourceHash: 'hash-flag',
        normalizedPayloadJson: {
          sourcePersonId: 'HCM-FLAG-001',
          assignmentStatus: 'terminated',
          supplier: supplier.companyName,
          workerType: 'CWK',
        },
        proposedContractorId: contractor.id,
        correlationMatchStatus: 'MATCHED',
        correlationConfidence: 'HIGH',
      },
    });

    await request(app.getHttpServer())
      .post('/contractor-sources/oracle-hcm/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const remediation = await prisma.contractorGovernanceRemediation.findFirst({
      where: { organizationId: org.id },
    });
    expect(remediation?.pdpRestrictionsApplied).toBe(true);
    expect(remediation?.remediationStatus).toBe(ContractorGovernanceRemediationStatus.OPEN);

    const drift = await prisma.contractorSourceDrift.findFirst({
      where: {
        organizationId: org.id,
        driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
      },
    });
    expect(drift).toBeTruthy();

    const unchanged = await prisma.contractor.findUnique({ where: { id: contractor.id } });
    expect(unchanged?.isActive).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CONTRACTOR_GOVERNANCE_REMEDIATION_EVENT_EMITTED' },
    });
    expect(audit).toBeTruthy();
  });

  it('POST acknowledge → verify → close clears PDP restrictions', async () => {
    const { org, token, userId } = await setupTenant();
    const prisma = TestHelper.getPrisma();

    const drift = await prisma.contractorSourceDrift.create({
      data: {
        organizationId: org.id,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
        severity: 'CRITICAL',
        status: 'CLASSIFIED',
        driftFingerprint: `${org.id}:GOVERNANCE_LIFECYCLE_CONFLICT::`,
      },
    });

    const create = await request(app.getHttpServer())
      .post('/contractor-governance/remediation/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ driftId: drift.id, assignedToUserId: userId })
      .expect(201);

    const remediationId = create.body.id;

    await request(app.getHttpServer())
      .post(`/contractor-governance/remediation/${remediationId}/acknowledge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: userId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/contractor-governance/remediation/${remediationId}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'HR confirmed termination' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/contractor-governance/remediation/${remediationId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolutionNotes: 'Access review complete — restrictions lifted' })
      .expect(201);

    const closed = await prisma.contractorGovernanceRemediation.findUnique({
      where: { id: remediationId },
    });
    expect(closed?.remediationStatus).toBe(ContractorGovernanceRemediationStatus.CLOSED);
    expect(closed?.pdpRestrictionsApplied).toBe(false);
  });

  it('GET dashboard includes remediation summary', async () => {
    const { token } = await setupTenant();

    const dashboard = await request(app.getHttpServer())
      .get('/contractor-sources/oracle-hcm/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.remediationSummary).toBeDefined();
    expect(dashboard.body.remediationSummary.activeRemediations).toBeDefined();
  });
});
