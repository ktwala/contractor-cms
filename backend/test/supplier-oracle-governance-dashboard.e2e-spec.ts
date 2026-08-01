import { INestApplication } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Oracle governance ops dashboard (PR-CMS-GOV-1E)', () => {
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

  it('1E.3 — reports Synced / Pending Evidence / Active / Suspended buckets', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });
    const prisma = TestHelper.getPrisma();

    await prisma.supplier.createMany({
      data: [
        {
          organizationId: org.id,
          type: SupplierType.COMPANY,
          status: SupplierStatus.PENDING_APPROVAL,
          companyName: 'Synced Pending Evidence',
          email: 'synced-pending@test.com',
          country: 'ZA',
          countryCode: 'ZA',
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: 'ORA-DASH-1',
          sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        },
        {
          organizationId: org.id,
          type: SupplierType.COMPANY,
          status: SupplierStatus.ACTIVE,
          companyName: 'Oracle Active',
          email: 'oracle-active@test.com',
          country: 'ZA',
          countryCode: 'ZA',
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: 'ORA-DASH-2',
          sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        },
        {
          organizationId: org.id,
          type: SupplierType.COMPANY,
          status: SupplierStatus.SUSPENDED,
          companyName: 'Oracle Suspended',
          email: 'oracle-suspended@test.com',
          country: 'ZA',
          countryCode: 'ZA',
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: 'ORA-DASH-3',
          sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
        },
        {
          organizationId: org.id,
          type: SupplierType.COMPANY,
          status: SupplierStatus.ACTIVE,
          companyName: 'CMS Native',
          email: 'cms-native@test.com',
          country: 'ZA',
          countryCode: 'ZA',
          sourceSystem: SupplierSourceSystem.CMS_NATIVE,
        },
      ],
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'dashboard.oracle@test.com',
      password: 'DashOra123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('dashboard.oracle@test.com', 'DashOra123!');

    const res = await request(app.getHttpServer())
      .get('/suppliers/governance-dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.oracleLinkedTotal).toBe(3);
    expect(res.body.buckets.synced).toBe(3);
    expect(res.body.buckets.active).toBe(1);
    expect(res.body.buckets.suspended).toBe(1);
    expect(res.body.buckets.pendingEvidence).toBeGreaterThanOrEqual(1);

    const activeList = await request(app.getHttpServer())
      .get('/suppliers?governanceBucket=active&limit=50')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(activeList.body.data.length).toBe(1);
    expect(activeList.body.data[0].email).toBe('oracle-active@test.com');
  });
});
