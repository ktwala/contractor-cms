import { INestApplication } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';

async function seedLsCompanyEvidence(
  prisma: ReturnType<typeof TestHelper.getPrisma>,
  supplierId: string,
  uploadedBy: string,
) {
  const future = new Date('2030-12-31');
  const entries = [
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION, expiry: null },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE, expiry: future },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION, expiry: null },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE, expiry: future },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID, expiry: null },
    { type: SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT, expiry: future },
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
        expiryDate: entry.expiry,
        uploadedBy,
      },
    });
  }
}

describe('Supplier jurisdiction evidence (PR-CMS-OPERATIONS-1D0)', () => {
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

  it('LS checklist excludes B-BBEE and can approve without ZA-only docs', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'PENDING_APPROVAL',
        companyName: 'Maseru Trading',
        email: 'ls-supplier@test.com',
        country: 'LS',
        countryCode: 'LS',
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.ls@test.com',
      password: 'ManagerLs123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    await seedLsCompanyEvidence(prisma, supplier.id, manager.id);

    const { token } = await TestHelper.login('manager.ls@test.com', 'ManagerLs123!');

    const checklist = await request(app.getHttpServer())
      .get(`/suppliers/${supplier.id}/evidence-checklist`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(checklist.body.jurisdictionCode).toBe('LS');
    expect(
      checklist.body.items.some(
        (i: { type: string }) => i.type === SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
      ),
    ).toBe(false);
    expect(checklist.body.complete).toBe(true);

    await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', reason: 'LS pack complete' })
      .expect(200);
  });

  it('rejects unsupported jurisdiction on create', async () => {
    const org = await TestHelper.createTestOrganization();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.bad@test.com',
      password: 'ManagerBad123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:create'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('manager.bad@test.com', 'ManagerBad123!');

    const res = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'COMPANY',
        companyName: 'BW Supplier',
        email: 'bw@test.com',
        countryCode: 'BW',
        country: 'BW',
        organizationId: org.id,
      })
      .expect(400);

    expect(res.body.code).toBe('UNSUPPORTED_SUPPLIER_JURISDICTION');
  });
});
