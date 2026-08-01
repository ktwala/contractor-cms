import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { SUPPLIER_MEMBERSHIP_REQUIRED_CODE } from '../src/domain/supplier-portal/supplier-portal.errors';
import { SUPPLIER_PORTAL_EMPTY_STATES } from '../src/domain/supplier-portal/supplier-portal.types';
import { TestHelper } from './utils/test-helper';

/** PR-SUPPLIER-PORTAL-DATA-1 — envelope + membership error contract. */
describe('Supplier portal data contract (PR-SUPPLIER-PORTAL-DATA-1)', () => {
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

  async function createPortalUser(orgId: string, supplierId: string) {
    const prisma = TestHelper.getPrisma();
    const portalUser = await TestHelper.createUserWithRoles(orgId, {
      email: 'supplier.data@test.com',
      password: 'SupplierData123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: portalUser.id,
        supplierId,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    return TestHelper.login('supplier.data@test.com', 'SupplierData123!');
  }

  it('returns envelope with supplier_context and empty contractors list', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Envelope Supplier Ltd',
        email: 'envelope@test.com',
        country: 'ZA',
      },
    });

    const { token } = await createPortalUser(org.id, supplier.id);

    const profile = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.status).toBe('ok');
    expect(profile.body.supplier_context.supplier_id).toBe(supplier.id);
    expect(profile.body.data.companyName).toBe('Envelope Supplier Ltd');

    const contractors = await request(app.getHttpServer())
      .get('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(contractors.body.status).toBe('ok');
    expect(contractors.body.data).toEqual([]);
    expect(contractors.body.empty_state).toBe(
      SUPPLIER_PORTAL_EMPTY_STATES.NO_CONTRACTORS,
    );

    const dashboard = await request(app.getHttpServer())
      .get('/supplier-portal/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.status).toBe('ok');
    expect(dashboard.body.data.contractors.count).toBe(0);
    expect(dashboard.body.data.profile.available).toBe(true);
  });

  it('returns SUPPLIER_MEMBERSHIP_REQUIRED when admin has no membership', async () => {
    const org = await TestHelper.createTestOrganization();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'admin.data@test.com',
      password: 'AdminData123!',
      roles: [
        {
          role: 'CMS_ADMIN',
          orgId: null,
          permissions: ['*:*'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('admin.data@test.com', 'AdminData123!');

    const res = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.code).toBe(SUPPLIER_MEMBERSHIP_REQUIRED_CODE);
  });
});
