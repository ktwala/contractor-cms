import { INestApplication } from '@nestjs/common';
import { PrismaClient, SupplierType } from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { INVALID_SUPPLIER_STATUS_TRANSITION } from '../src/domain/suppliers/supplier-lifecycle.constants';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';

async function seedCompanyEvidence(
  prisma: PrismaClient,
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

describe('Supplier lifecycle (PR-CMS-OPERATIONS-1A)', () => {
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

  it('PENDING_APPROVAL → ACTIVE requires approve permission and writes audit', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Lifecycle Supplier',
        email: 'lifecycle@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.lifecycle@test.com',
      password: 'ManagerLife123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    await seedCompanyEvidence(prisma, supplier.id, manager.id);

    const { token } = await TestHelper.login(
      'manager.lifecycle@test.com',
      'ManagerLife123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'ACTIVE',
        reason: 'All onboarding evidence reviewed',
      })
      .expect(200);

    expect(res.body.status).toBe('ACTIVE');

    const audit = await prisma.auditLog.findMany({
      where: { targetId: supplier.id, action: 'SUPPLIER_APPROVED' },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects OFFBOARDED → ACTIVE with INVALID_SUPPLIER_STATUS_TRANSITION', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'OFFBOARDED',
        companyName: 'Offboarded Co',
        email: 'offboarded@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager2.lifecycle@test.com',
      password: 'ManagerLife2123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'manager2.lifecycle@test.com',
      'ManagerLife2123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE' })
      .expect(400);

    expect(res.body.code).toBe(INVALID_SUPPLIER_STATUS_TRANSITION);
  });
});
