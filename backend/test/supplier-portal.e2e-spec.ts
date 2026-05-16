import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

describe('Supplier portal API (PR-SUPPLIER-PORTAL-UI-1)', () => {
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

  it('supplier admin uses portal routes only; client /suppliers is forbidden', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplierA = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'a@test.com',
        country: 'ZA',
      },
    });

    await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Other Supplier Ltd',
        email: 'b@test.com',
        country: 'ZA',
      },
    });

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.admin@test.com',
      password: 'SupplierAdmin123!',
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
        supplierId: supplierA.id,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    const { token } = await TestHelper.login(
      'supplier.admin@test.com',
      'SupplierAdmin123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.companyName).toBe('Demo Supplier Ltd');
    expect(profile.body.id).toBe(supplierA.id);

    await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/supplier-portal/resources')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/supplier-portal/resources')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Portal',
        lastName: 'Resource',
        email: 'portal.resource@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
      })
      .expect(201);
  });
});
