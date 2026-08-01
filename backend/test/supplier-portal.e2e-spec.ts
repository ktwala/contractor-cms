import { INestApplication } from '@nestjs/common';
import { ContractType, SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { TestHelper } from './utils/test-helper';

async function seedCompanyEvidence(
  prisma: ReturnType<typeof TestHelper.getPrisma>,
  supplierId: string,
  uploadedBy: string,
) {
  const future = new Date('2030-12-31');
  const types = [
    SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
    SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
    SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
    SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
    SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
  ];

  for (const type of types) {
    const needsExpiry =
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION &&
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION &&
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID;

    await prisma.supplierDocument.create({
      data: {
        supplierId,
        type,
        fileName: `${type}.pdf`,
        filePath: `uploads/test/${type}.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: needsExpiry ? future : null,
        uploadedBy,
      },
    });
  }
}

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

    await seedCompanyEvidence(prisma, supplierA.id, portalUser.id);

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplierA.id,
        contractNumber: `PORTAL-MSA-${Date.now()}`,
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Portal Test MSA',
        startDate: new Date(),
        status: 'ACTIVE',
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

    expect(profile.body.status).toBe('ok');
    expect(profile.body.supplier_context.supplier_id).toBe(supplierA.id);
    expect(profile.body.data.companyName).toBe('Demo Supplier Ltd');
    expect(profile.body.data.id).toBe(supplierA.id);

    await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/supplier-portal/resources')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const createBody = {
      firstName: 'Portal',
      lastName: 'Contractor',
      email: 'portal.contractor@test.com',
      workerClassification: 'INDEPENDENT_CONTRACTOR',
      engagementModel: 'DIRECT',
      taxResidency: 'ZA',
      engagement: {
        contractId: contract.id,
        role: 'Portal Developer',
        startDate: '2026-06-01',
        rateType: 'HOURLY',
        rateAmount: 750,
      },
    };

    const created = await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .send(createBody)
      .expect(201);

    expect(created.body.workforceState).toBe('NOMINATED');
    expect(created.body.isActive).toBe(false);

    const listed = await request(app.getHttpServer())
      .get('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listed.body.data.some((c: { email: string }) => c.email === createBody.email)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .send(createBody)
      .expect(409);

    await request(app.getHttpServer())
      .post('/supplier-portal/resources')
      .set('Authorization', `Bearer ${token}`)
      .send(createBody)
      .expect(404);
  });
});
