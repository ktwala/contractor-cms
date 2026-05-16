import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

/**
 * PR-SUPPLIER-SCOPING-1 — row-scope isolation proof.
 * Supplier-portal user bound to supplier A must not see supplier B or its rows.
 */
describe('Supplier membership row isolation (PR-SUPPLIER-SCOPING-1)', () => {
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

  it('supplier admin sees only their supplier; other supplier and rows are invisible', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplierA = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'supplier-a@test.com',
        country: 'ZA',
      },
    });

    const supplierB = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Other Supplier Ltd',
        email: 'supplier-b@test.com',
        country: 'ZA',
      },
    });

    const contractorB = await prisma.contractor.create({
      data: {
        supplierId: supplierB.id,
        firstName: 'Other',
        lastName: 'Resource',
        email: 'resource-b@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    await prisma.timesheet.create({
      data: {
        contractorId: contractorB.id,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-07'),
        status: 'SUBMITTED',
        totalHours: 40,
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

    const listRes = await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.total).toBe(1);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(supplierA.id);
    expect(listRes.body.data[0].companyName).toBe('Demo Supplier Ltd');

    await request(app.getHttpServer())
      .get(`/suppliers/${supplierB.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const timesheetsRes = await request(app.getHttpServer())
      .get('/timesheets')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(timesheetsRes.body).toBeDefined();
  });

  it('fails closed when supplier-portal permissions exist without membership', async () => {
    const org = await TestHelper.createTestOrganization();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'orphan.supplier@test.com',
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

    await TestHelper.login('orphan.supplier@test.com', 'SupplierAdmin123!');

    await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${TestHelper.getAuthToken()}`)
      .expect(403);
  });
});
