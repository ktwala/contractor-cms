import { INestApplication } from '@nestjs/common';
import {
  ContractType,
  ResponsibleManagerAccountabilityStatus,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

const SPONSOR_A_REF = 'cms:emp:sponsor-a';
const SPONSOR_B_REF = 'cms:emp:sponsor-b';

/**
 * PR-SPONSOR-SCOPE-VALIDATION-1 — row-scope isolation for business sponsors.
 * Route allow (200) is insufficient; lists must only include sponsored rows.
 */
describe('Business sponsor row isolation (PR-SPONSOR-SCOPE-VALIDATION-1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED = 'true';
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  it('sponsor sees only contractors and engagements they sponsor', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Sponsor Scope Supplier',
        email: 'supplier-scope@test.com',
        country: 'ZA',
      },
    });

    const sponsoredContractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Sponsored',
        lastName: 'Worker',
        email: 'sponsored-worker@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const otherContractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Other',
        lastName: 'Worker',
        email: 'other-worker@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'SCOPE-MSA-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Scope test MSA',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const sponsoredEngagement = await prisma.contractorEngagement.create({
      data: {
        contractorId: sponsoredContractor.id,
        contractId: contract.id,
        role: 'Sponsored placement',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 1000,
        responsibleManagerEmployeeId: SPONSOR_A_REF,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });

    const unsponsoredEngagement = await prisma.contractorEngagement.create({
      data: {
        contractorId: otherContractor.id,
        contractId: contract.id,
        role: 'Unsponsored placement',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 1000,
      },
    });

    const sponsorA = await TestHelper.createUserWithRoles(org.id, {
      email: 'sponsor.a@test.com',
      password: 'SponsorA123!',
      roles: [
        {
          role: 'SPONSOR',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    await prisma.user.update({
      where: { id: sponsorA.id },
      data: { externalId: SPONSOR_A_REF, externalProvider: 'HCM' },
    });

    const { token } = await TestHelper.login('sponsor.a@test.com', 'SponsorA123!');

    const contractorsRes = await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(contractorsRes.body.total).toBe(1);
    expect(contractorsRes.body.data).toHaveLength(1);
    expect(contractorsRes.body.data[0].id).toBe(sponsoredContractor.id);
    expect(contractorsRes.body.data[0].email).toBe('sponsored-worker@test.com');

    const engagementsRes = await request(app.getHttpServer())
      .get('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(engagementsRes.body.total).toBe(1);
    expect(engagementsRes.body.data).toHaveLength(1);
    expect(engagementsRes.body.data[0].id).toBe(sponsoredEngagement.id);
    expect(engagementsRes.body.data[0].responsibleManagerEmployeeId).toBe(SPONSOR_A_REF);

    await request(app.getHttpServer())
      .get(`/contractors/${otherContractor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/engagements/${unsponsoredEngagement.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('cross-sponsor: sponsor B does not see sponsor A placements', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Cross Sponsor Supplier',
        email: 'cross-sponsor@test.com',
        country: 'ZA',
      },
    });

    const contractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Only',
        lastName: 'ForA',
        email: 'for-sponsor-a@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'CROSS-MSA-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Cross sponsor MSA',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.contractorEngagement.create({
      data: {
        contractorId: contractor.id,
        contractId: contract.id,
        role: 'Sponsor A only',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 500,
        responsibleManagerEmployeeId: SPONSOR_A_REF,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });

    const sponsorB = await TestHelper.createUserWithRoles(org.id, {
      email: 'sponsor.b@test.com',
      password: 'SponsorB123!',
      roles: [
        {
          role: 'SPONSOR',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    await prisma.user.update({
      where: { id: sponsorB.id },
      data: { externalId: SPONSOR_B_REF, externalProvider: 'HCM' },
    });

    const { token } = await TestHelper.login('sponsor.b@test.com', 'SponsorB123!');

    const contractorsRes = await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(contractorsRes.body.total).toBe(0);
    expect(contractorsRes.body.data).toHaveLength(0);

    const engagementsRes = await request(app.getHttpServer())
      .get('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(engagementsRes.body.total).toBe(0);
    expect(engagementsRes.body.data).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/contractors/${contractor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('internal manager with HCM externalId and sponsor reads sees sponsored rows only', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'HCM Manager Supplier',
        email: 'hcm-mgr-supplier@test.com',
        country: 'ZA',
      },
    });

    const sponsoredContractor = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'HCM',
        lastName: 'Sponsored',
        email: 'hcm-sponsored@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'HCM',
        lastName: 'Unsponsored',
        email: 'hcm-unsponsored@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'HCM-MGR-MSA',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'HCM manager MSA',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.contractorEngagement.create({
      data: {
        contractorId: sponsoredContractor.id,
        contractId: contract.id,
        role: 'Manager-sponsored',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 800,
        responsibleManagerEmployeeId: SPONSOR_A_REF,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });

    const manager = await TestHelper.createUserWithRoles(org.id, {
      email: 'hcm.manager@test.com',
      password: 'HcmManager123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: [
            'contractors:read',
            'engagements:read',
            'engagements:update',
            'suppliers:read',
          ],
        },
      ],
    });
    await prisma.user.update({
      where: { id: manager.id },
      data: { externalId: SPONSOR_A_REF, externalProvider: 'HCM' },
    });

    const { token } = await TestHelper.login('hcm.manager@test.com', 'HcmManager123!');

    const contractorsRes = await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(contractorsRes.body.total).toBe(1);
    expect(contractorsRes.body.data[0].email).toBe('hcm-sponsored@test.com');
  });

  it('internal user with externalId but no sponsor read permissions is not row-scoped', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'No Perm Supplier',
        email: 'no-perm@test.com',
        country: 'ZA',
      },
    });

    await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Wide',
        lastName: 'View',
        email: 'wide-view@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const limited = await TestHelper.createUserWithRoles(org.id, {
      email: 'hcm.limited@test.com',
      password: 'HcmLimited123!',
      roles: [
        {
          role: 'PROFILE_ONLY',
          orgId: org.id,
          permissions: ['profile:read', 'profile:update'],
        },
      ],
    });
    await prisma.user.update({
      where: { id: limited.id },
      data: { externalId: SPONSOR_A_REF, externalProvider: 'HCM' },
    });

    await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${(await TestHelper.login('hcm.limited@test.com', 'HcmLimited123!')).token}`)
      .expect(403);
  });

  it('SPONSOR role without externalId is not row-scoped (demo scaffold guard)', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'No HCM Ref Supplier',
        email: 'no-hcm@test.com',
        country: 'ZA',
      },
    });

    await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Visible',
        lastName: 'OrgWide',
        email: 'org-wide@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'sponsor.no-hcm@test.com',
      password: 'SponsorNoHcm123!',
      roles: [
        {
          role: 'SPONSOR',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'sponsor.no-hcm@test.com',
      'SponsorNoHcm123!',
    );

    const contractorsRes = await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(contractorsRes.body.total).toBe(1);
  });
});
