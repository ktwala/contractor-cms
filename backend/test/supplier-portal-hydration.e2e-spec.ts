import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

/**
 * PR-SUPPLIER-PORTAL-HYDRATION-FIX-1 — membership scope + auth profile contract.
 */
describe('Supplier portal hydration (PR-SUPPLIER-PORTAL-HYDRATION-FIX-1)', () => {
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

  it('supplier persona: profile/me exposes supplierId; portal surfaces return 200', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'hydration@test.com',
        country: 'ZA',
      },
    });

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.hydration@test.com',
      password: 'SupplierHydrate123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: portalUser.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    const { token } = await TestHelper.login(
      'supplier.hydration@test.com',
      'SupplierHydrate123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.supplierId).toBe(supplier.id);
    expect(profile.body.effectivePermissions).toEqual(
      expect.arrayContaining([
        'supplier-contractors:read',
        'supplier-contractors:create',
      ]),
    );
    expect(profile.body.effectivePermissions).not.toEqual(
      expect.arrayContaining(['supplier-resources:read']),
    );

    await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/supplier-portal/resources')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('platform admin without membership: portal routes return 403 with membership message', async () => {
    const org = await TestHelper.createTestOrganization();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'admin.hydration@test.com',
      password: 'AdminHydrate123!',
      roles: [
        {
          role: 'CMS_ADMIN',
          orgId: null,
          permissions: ['*:*'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'admin.hydration@test.com',
      'AdminHydrate123!',
    );

    const res = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.code).toBe('SUPPLIER_MEMBERSHIP_REQUIRED');
    expect(res.body.message).toMatch(/supplier membership/i);
  });
});
