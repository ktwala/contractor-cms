import { INestApplication } from '@nestjs/common';
import { PrismaClient, SupplierType } from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE } from '../src/domain/suppliers/supplier-evidence.errors';

async function seedCompanyEvidence(
  prisma: PrismaClient,
  supplierId: string,
  uploadedBy: string,
  options?: { taxExpiry?: Date },
) {
  const future = options?.taxExpiry ?? new Date('2030-12-31');
  const entries: Array<{
    type: string;
    expiryDate: Date | null;
  }> = [
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION, expiryDate: null },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE, expiryDate: future },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION, expiryDate: null },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE, expiryDate: future },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID, expiryDate: null },
    {
      type: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
      expiryDate: future,
    },
  ];

  for (const entry of entries) {
    await prisma.supplierDocument.create({
      data: {
        supplierId,
        type: entry.type,
        fileName: `${entry.type}.pdf`,
        filePath: `uploads/test/${entry.type}.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: entry.expiryDate,
        uploadedBy,
      },
    });
  }
}

describe('Supplier onboarding evidence (PR-CMS-OPERATIONS-1B)', () => {
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

  it('blocks PENDING_APPROVAL → ACTIVE when required evidence is missing', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Incomplete Evidence Co',
        email: 'incomplete@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.evidence@test.com',
      password: 'ManagerEv123!',
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
      'manager.evidence@test.com',
      'ManagerEv123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', reason: 'Attempt approve' })
      .expect(400);

    expect(res.body.code).toBe(SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE);
    expect(res.body.checklist?.complete).toBe(false);

    const stillPending = await prisma.supplier.findUnique({
      where: { id: supplier.id },
    });
    expect(stillPending?.status).toBe('PENDING_APPROVAL');
  });

  it('allows PENDING_APPROVAL → ACTIVE when evidence checklist is complete', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Complete Evidence Co',
        email: 'complete@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.evidence2@test.com',
      password: 'ManagerEv2123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve', 'suppliers:update'],
          isSystemRole: true,
        },
      ],
    });

    await seedCompanyEvidence(prisma, supplier.id, manager.id);

    const { token } = await TestHelper.login(
      'manager.evidence2@test.com',
      'ManagerEv2123!',
    );

    const checklist = await request(app.getHttpServer())
      .get(`/suppliers/${supplier.id}/evidence-checklist`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(checklist.body.complete).toBe(true);

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', reason: 'Evidence complete' })
      .expect(200);

    expect(res.body.status).toBe('ACTIVE');
  });

  it('treats expired required documents as incomplete', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Expired Evidence Co',
        email: 'expired@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.evidence3@test.com',
      password: 'ManagerEv3123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    await seedCompanyEvidence(prisma, supplier.id, manager.id, {
      taxExpiry: new Date('2019-01-01'),
    });

    const { token } = await TestHelper.login(
      'manager.evidence3@test.com',
      'ManagerEv3123!',
    );

    const checklist = await request(app.getHttpServer())
      .get(`/suppliers/${supplier.id}/evidence-checklist`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(checklist.body.complete).toBe(false);
    expect(checklist.body.expiredCount).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE' })
      .expect(400);
  });

  it('writes audit events when document metadata is added', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Audit Doc Co',
        email: 'auditdoc@test.com',
        country: 'ZA',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.evidence4@test.com',
      password: 'ManagerEv4123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:update'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'manager.evidence4@test.com',
      'ManagerEv4123!',
    );

    const created = await request(app.getHttpServer())
      .post(`/suppliers/${supplier.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
        fileName: 'cipc.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
      })
      .expect(201);

    const audit = await prisma.auditLog.findMany({
      where: {
        targetId: created.body.id,
        action: 'SUPPLIER_DOCUMENT_ADDED',
      },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });
});
