import { INestApplication } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceDriftSeverity,
  SupplierSourceDriftType,
  SupplierStatus,
  SupplierSourceSyncStatus,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

describe('Oracle connector drift registry (PR-CMS-CONNECTOR-4)', () => {
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
      email: 'connector.drift@test.com',
      password: 'ConnectorDrift123!',
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
      'connector.drift@test.com',
      'ConnectorDrift123!',
    );

    return { org, token };
  }

  async function seedSuccessfulSyncRun(orgId: string) {
    const prisma = TestHelper.getPrisma();
    return prisma.supplierSourceSyncRun.create({
      data: {
        organizationId: orgId,
        sourceSystem: 'ORACLE_SUPPLIER_SAAS',
        status: 'SUCCEEDED',
        mode: 'INCREMENTAL',
        startedAt: new Date(),
        finishedAt: new Date(),
        importedCount: 1,
        matchedCount: 1,
        newCount: 0,
        failedCount: 0,
      },
    });
  }

  it('POST drift/detect registers GOVERNANCE_STATE_CONFLICT without mutating supplier', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();
    await seedSuccessfulSyncRun(org.id);

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: 'COMPANY',
        status: SupplierStatus.ACTIVE,
        companyName: 'Drift Test Co',
        email: 'drift@test.com',
        phone: '000',
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: 'ORACLE_SUPPLIER_SAAS',
        externalSupplierId: 'ORA-DRIFT-ACTIVE',
        sourceSyncStatus: SupplierSourceSyncStatus.NOT_SYNCED,
      },
    });

    const detect = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(detect.body.detected).toBeGreaterThan(0);

    const drift = await prisma.supplierSourceDrift.findFirst({
      where: {
        organizationId: org.id,
        driftType: SupplierSourceDriftType.GOVERNANCE_STATE_CONFLICT,
      },
    });
    expect(drift?.severity).toBe(SupplierSourceDriftSeverity.CRITICAL);
    expect(drift?.supplierId).toBe(supplier.id);

    const unchanged = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    expect(unchanged?.status).toBe(SupplierStatus.ACTIVE);
  });

  it('POST drift/:id/resolve closes drift workflow without setting supplier ACTIVE from drift', async () => {
    const { org, token } = await setupOracleTenant();
    const prisma = TestHelper.getPrisma();
    await seedSuccessfulSyncRun(org.id);

    await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: 'COMPANY',
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Resolve Drift Co',
        email: 'resolve@test.com',
        phone: '000',
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: 'ORACLE_SUPPLIER_SAAS',
        externalSupplierId: 'ORA-DRIFT-RESOLVE',
        sourceSyncStatus: SupplierSourceSyncStatus.NOT_SYNCED,
      },
    });

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const drift = await prisma.supplierSourceDrift.findFirst({
      where: { organizationId: org.id },
    });
    expect(drift).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/supplier-sources/oracle/drift/${drift!.id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolutionNotes: 'Reviewed — governance action tracked manually' })
      .expect(201);

    const resolved = await prisma.supplierSourceDrift.findUnique({
      where: { id: drift!.id },
    });
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.resolutionNotes).toContain('manually');
  });

  it('GET dashboard includes drift summary', async () => {
    const { token } = await setupOracleTenant();

    const dashboard = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.driftSummary).toBeDefined();
    expect(dashboard.body.driftSummary.openTotal).toBeDefined();
    expect(dashboard.body.supplierSyncAssessment).toBeDefined();
    expect(dashboard.body.supplierSyncAssessment.lifecyclePhase).toBe(
      'SYNCHRONIZATION_PENDING',
    );
  });

  it('POST drift/detect rejects repeat assessment for the same sync snapshot', async () => {
    const { org, token } = await setupOracleTenant();
    await seedSuccessfulSyncRun(org.id);

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/drift/detect')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
