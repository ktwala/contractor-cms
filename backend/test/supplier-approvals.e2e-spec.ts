import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE } from '../src/domain/suppliers/supplier-evidence.errors';
import {
  SUPPLIER_SELF_APPROVAL_FORBIDDEN,
  SUPPLIER_TRANSITION_REASON_REQUIRED,
} from '../src/domain/suppliers/supplier-lifecycle.constants';

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

describe('Supplier approval queue (PR-CMS-OPERATIONS-1C)', () => {
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

  it('lists PENDING_APPROVAL suppliers with evidence summary', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const complete = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Queue Complete Co',
        email: 'queue-complete@test.com',
        country: 'ZA',
      },
    });

    const incomplete = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Queue Incomplete Co',
        email: 'queue-incomplete@test.com',
        country: 'ZA',
      },
    });

    await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Not In Queue',
        email: 'active@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.queue@test.com',
      password: 'ManagerQ123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve', 'suppliers:suspend'],
          isSystemRole: true,
        },
      ],
    });

    await seedCompanyEvidence(prisma, complete.id, manager.id);

    const { token } = await TestHelper.login('manager.queue@test.com', 'ManagerQ123!');

    const res = await request(app.getHttpServer())
      .get('/suppliers/approvals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBe(2);
    const byId = Object.fromEntries(
      res.body.data.map((row: { id: string }) => [row.id, row]),
    );
    expect(byId[complete.id].evidenceStatus).toBe('COMPLETE');
    expect(byId[incomplete.id].evidenceStatus).toBe('INCOMPLETE');
    expect(res.body.data.every((r: { status: string }) => r.status === 'PENDING_APPROVAL')).toBe(
      true,
    );
  });

  it('blocks approve when evidence incomplete and allows when complete', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Approve Gate Co',
        email: 'approve-gate@test.com',
        country: 'ZA',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.queue2@test.com',
      password: 'ManagerQ2123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('manager.queue2@test.com', 'ManagerQ2123!');

    const blocked = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE' })
      .expect(400);

    expect(blocked.body.code).toBe(SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE);

    const manager = await prisma.user.findFirst({
      where: { email: 'manager.queue2@test.com' },
    });
    await seedCompanyEvidence(prisma, supplier.id, manager!.id);

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', reason: 'Approved from queue test' })
      .expect(200);

    const audit = await prisma.auditLog.findMany({
      where: { targetId: supplier.id, action: 'SUPPLIER_APPROVED' },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('requires reviewer note to reject PENDING_APPROVAL supplier', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Reject Note Co',
        email: 'reject-note@test.com',
        country: 'ZA',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.queue3@test.com',
      password: 'ManagerQ3123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:suspend'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('manager.queue3@test.com', 'ManagerQ3123!');

    const missing = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED' })
      .expect(400);

    expect(missing.body.code).toBe(SUPPLIER_TRANSITION_REASON_REQUIRED);

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', reason: 'Missing tax clearance' })
      .expect(200);

    const audit = await prisma.auditLog.findMany({
      where: { targetId: supplier.id, action: 'SUPPLIER_REJECTED' },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('forbids supplier-scoped user from approving own supplier', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Self Approve Co',
        email: 'self-approve@test.com',
        country: 'ZA',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.queue4@test.com',
      password: 'ManagerQ4123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.admin.self@test.com',
      password: 'SupplierSelf123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: ['suppliers:approve', 'suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: portalUser.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: manager.id,
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, portalUser.id);

    const { token } = await TestHelper.login(
      'supplier.admin.self@test.com',
      'SupplierSelf123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', reason: 'Self approve attempt' })
      .expect(403);

    expect(res.body.code).toBe(SUPPLIER_SELF_APPROVAL_FORBIDDEN);
  });
});
