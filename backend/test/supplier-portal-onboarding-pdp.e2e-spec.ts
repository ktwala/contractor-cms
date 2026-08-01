import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE } from '../src/domain/suppliers/supplier-evidence.errors';
import { SUPPLIER_SELF_APPROVAL_FORBIDDEN } from '../src/domain/suppliers/supplier-lifecycle.constants';
import { PDP_GOVERNANCE_BLOCKED } from '../src/pdp/pdp-governance.errors';
import { PdpReasonCode } from '../src/pdp/pdp.reason-codes';
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

async function createPortalUser(
  orgId: string,
  supplierId: string,
  email: string,
  password: string,
) {
  const prisma = TestHelper.getPrisma();
  const user = await TestHelper.createUserWithRoles(orgId, {
    email,
    password,
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
      userId: user.id,
      supplierId,
      role: 'ADMIN',
      assignedBy: user.id,
    },
  });

  const login = await TestHelper.login(email, password);
  return { ...login, portalUserId: user.id };
}

describe('Supplier portal onboarding + PDP (PR-CMS-OPERATIONS-1D2)', () => {
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

  it('blocks submit when PENDING_APPROVAL with incomplete evidence', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Incomplete Portal Co',
        email: 'incomplete-portal@test.com',
        country: 'ZA',
        countryCode: 'ZA',
        bankAccountNumber: '999888777',
        taxNumber: 'TAX-SECRET',
      },
    });

    const { token } = await createPortalUser(
      org.id,
      supplier.id,
      'portal.incomplete@test.com',
      'PortalInc123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.data.onboarding.canSubmit).toBe(false);
    expect(profile.body.data.bankAccountNumber).toBeNull();
    expect(profile.body.data.taxNumber).toBeNull();

    const blocked = await request(app.getHttpServer())
      .post('/supplier-portal/submit-for-approval')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(blocked.body.code).toBe(SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE);
  });

  it('allows submit when PENDING_APPROVAL with complete evidence (ops queue)', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Complete Portal Co',
        email: 'complete-portal@test.com',
        country: 'ZA',
        countryCode: 'ZA',
      },
    });

    const { token, portalUserId } = await createPortalUser(
      org.id,
      supplier.id,
      'portal.complete@test.com',
      'PortalComp123!',
    );

    await seedCompanyEvidence(prisma, supplier.id, portalUserId);

    const submit = await request(app.getHttpServer())
      .post('/supplier-portal/submit-for-approval')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(submit.body.data.inApprovalQueue).toBe(true);
    expect(submit.body.data.submitted).toBe(true);

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.portal.queue@test.com',
      password: 'ManagerPQ123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    const managerLogin = await TestHelper.login(
      'manager.portal.queue@test.com',
      'ManagerPQ123!',
    );

    const queue = await request(app.getHttpServer())
      .get('/suppliers/approvals')
      .set('Authorization', `Bearer ${managerLogin.token}`)
      .expect(200);

    expect(queue.body.data.some((r: { id: string }) => r.id === supplier.id)).toBe(
      true,
    );
  });

  it('forbids supplier portal user from self-approving via client status route', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Self Block Co',
        email: 'self-block@test.com',
        country: 'ZA',
      },
    });

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'portal.self.approve@test.com',
      password: 'PortalSelf123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [
            ...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN,
            'suppliers:approve',
          ],
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

    await seedCompanyEvidence(prisma, supplier.id, portalUser.id);

    const { token } = await TestHelper.login(
      'portal.self.approve@test.com',
      'PortalSelf123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE' })
      .expect(403);

    expect(res.body.code).toBe(SUPPLIER_SELF_APPROVAL_FORBIDDEN);
  });

  it('PDP blocks operational contractor create when supplier is not ACTIVE', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'PDP Block Co',
        email: 'pdp-block@test.com',
        country: 'ZA',
        countryCode: 'ZA',
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, supplier.id);

    const { token } = await createPortalUser(
      org.id,
      supplier.id,
      'portal.pdp@test.com',
      'PortalPdp123!',
    );

    const res = await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'New',
        lastName: 'Contractor',
        email: 'new.contractor@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        engagement: {
          contractId: '00000000-0000-0000-0000-000000000000',
          role: 'Developer',
          startDate: '2026-06-01',
          rateType: 'HOURLY',
          rateAmount: 500,
        },
      })
      .expect(403);

    expect(res.body.code).toBe(PDP_GOVERNANCE_BLOCKED);
    expect(res.body.reason_code).toBe(PdpReasonCode.SUPPLIER_NOT_APPROVED);
  });

  it('PDP blocks timesheet submit when required evidence is expired', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Expired Evidence Co',
        email: 'expired-evidence@test.com',
        country: 'ZA',
        countryCode: 'ZA',
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, supplier.id);

    await prisma.supplierDocument.updateMany({
      where: {
        supplierId: supplier.id,
        type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
      },
      data: { expiryDate: new Date('2020-01-01') },
    });

    const contractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Ops',
        lastName: 'Worker',
        email: 'ops.worker@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const timesheet = await prisma.timesheet.create({
      data: {
        contractorId: contractor.id,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-07'),
        status: 'DRAFT',
        totalHours: 8,
        entries: {
          create: [
            {
              date: new Date('2026-01-02'),
              hours: 8,
              description: 'Work',
            },
          ],
        },
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.timesheet.pdp@test.com',
      password: 'ManagerTP123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['timesheets:read', 'timesheets:update'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'manager.timesheet.pdp@test.com',
      'ManagerTP123!',
    );

    const res = await request(app.getHttpServer())
      .patch(`/timesheets/${timesheet.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.code).toBe(PDP_GOVERNANCE_BLOCKED);
    expect(res.body.reason_code).toBe(PdpReasonCode.MISSING_REQUIRED_DOCS);
  });
});
