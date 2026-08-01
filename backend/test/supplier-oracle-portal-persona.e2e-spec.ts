import { INestApplication } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { SUPPLIER_MASTER_CREATION_FORBIDDEN } from '../src/core/authority/authority.constants';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { TestHelper } from './utils/test-helper';

async function seedCompanyEvidence(
  prisma: ReturnType<typeof TestHelper.getPrisma>,
  supplierId: string,
  uploadedBy: string,
  jurisdiction: 'ZA' | 'LS' = 'ZA',
) {
  const future = new Date('2030-12-31');
  const types =
    jurisdiction === 'LS'
      ? [
          SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
          SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
          SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
          SUPPLIER_EVIDENCE_DOC_TYPES.TRADING_LICENCE,
          SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
          SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
        ]
      : [
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

describe('Oracle portal governance persona (PR-CMS-GOV-1E)', () => {
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

  async function setupOracleOrgWithPromotedTwin() {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });
    const prisma = TestHelper.getPrisma();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'ops.oracle.persona@test.com',
      password: 'OpsOraPersona123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read', 'suppliers:update', 'suppliers:approve'],
          isSystemRole: true,
        },
      ],
    });

    const { token: opsToken } = await TestHelper.login(
      'ops.oracle.persona@test.com',
      'OpsOraPersona123!',
    );

    const existing = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Cape Services Group',
        email: 'cape-governance@test.com',
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-20002',
        taxNumber: 'ZA-TAX-20002',
      },
    });

    const payload = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/oracle-supplier-extract/mock-suppliers.json'),
        'utf-8',
      ),
    );

    const importRes = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${opsToken}`)
      .send(payload)
      .expect(201);

    const matchedStaging = importRes.body.rows.find(
      (r: { externalSupplierId: string }) => r.externalSupplierId === 'ORA-20002',
    );

    const promoted = await request(app.getHttpServer())
      .post(`/supplier-sources/oracle/staging/${matchedStaging.id}/promote`)
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(201);

    expect(promoted.body.outcome).toBe('LINKED');
    expect(promoted.body.supplierId).toBe(existing.id);

    expect(promoted.body.status).toBe('PENDING_APPROVAL');

    const twin = await prisma.supplier.findUnique({
      where: { id: promoted.body.supplierId },
    });
    expect(twin?.sourceSystem).toBe(SupplierSourceSystem.ORACLE_SUPPLIER_SAAS);

    return {
      org,
      prisma,
      opsToken,
      twinId: promoted.body.supplierId as string,
      jurisdiction: 'ZA' as const,
    };
  }

  it('1E.1 — Oracle-linked supplier completes compliance profile and enters ops queue', async () => {
    const { org, prisma, opsToken, twinId, jurisdiction } =
      await setupOracleOrgWithPromotedTwin();

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'portal.oracle.persona@test.com',
      password: 'PortalOraPersona123!',
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
        supplierId: twinId,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    const { token: portalToken } = await TestHelper.login(
      'portal.oracle.persona@test.com',
      'PortalOraPersona123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${portalToken}`)
      .expect(200);

    expect(profile.body.data.onboarding.inApprovalQueue).toBe(true);
    expect(profile.body.data.onboarding.canSubmit).toBe(false);

    await seedCompanyEvidence(prisma, twinId, portalUser.id, jurisdiction);

    const readyProfile = await request(app.getHttpServer())
      .get('/supplier-portal/profile')
      .set('Authorization', `Bearer ${portalToken}`)
      .expect(200);

    expect(readyProfile.body.data.onboarding.evidenceComplete).toBe(true);
    expect(readyProfile.body.data.onboarding.canSubmit).toBe(true);

    const submit = await request(app.getHttpServer())
      .post('/supplier-portal/submit-for-approval')
      .set('Authorization', `Bearer ${portalToken}`)
      .expect(201);

    expect(submit.body.data.inApprovalQueue).toBe(true);

    const twinAfter = await prisma.supplier.findUnique({ where: { id: twinId } });
    expect(twinAfter?.status).toBe(SupplierStatus.PENDING_APPROVAL);

    const queue = await request(app.getHttpServer())
      .get('/suppliers/approvals')
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(queue.body.data.some((r: { id: string }) => r.id === twinId)).toBe(true);
  });

  it('1E.2 — portal user cannot create supplier master on ORACLE_ONLY tenant', async () => {
    const { org, twinId } = await setupOracleOrgWithPromotedTwin();
    const prisma = TestHelper.getPrisma();

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'portal.create.blocked@test.com',
      password: 'PortalBlock123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [
            ...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN,
            'suppliers:create',
          ],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: portalUser.id,
        supplierId: twinId,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    const { token } = await TestHelper.login(
      'portal.create.blocked@test.com',
      'PortalBlock123!',
    );

    const blocked = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId: org.id,
        type: SupplierType.COMPANY,
        companyName: 'Forbidden Master',
        email: 'forbidden-master@test.com',
        country: 'ZA',
        countryCode: 'ZA',
      })
      .expect(403);

    expect(blocked.body.code).toBe(SUPPLIER_MASTER_CREATION_FORBIDDEN);
  });

  it('exposes ORACLE_ONLY tenantAuthority on auth profile for portal user', async () => {
    const { org, twinId } = await setupOracleOrgWithPromotedTwin();
    const prisma = TestHelper.getPrisma();

    const portalUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'portal.profile.authority@test.com',
      password: 'PortalAuth123!',
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
        supplierId: twinId,
        role: 'ADMIN',
        assignedBy: portalUser.id,
      },
    });

    const { token } = await TestHelper.login(
      'portal.profile.authority@test.com',
      'PortalAuth123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.tenantAuthority.supplierAuthorityMode).toBe('ORACLE_ONLY');
  });
});
