import { INestApplication } from '@nestjs/common';
import { ContractType, SupplierType } from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

const SPONSOR_REF = 'cms:emp:ref-only-sponsor';

/**
 * PR-SPONSOR-REFERENCE-ONLY-1 — default: sponsor fields on engagement + IGA publish;
 * no CMS inbox, nav, or row scope unless RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED=true.
 */
describe('Sponsor reference only (PR-SPONSOR-REFERENCE-ONLY-1)', () => {
  let app: INestApplication;
  const previousFlag = process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED;

  beforeAll(async () => {
    process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED = 'false';
    app = await TestHelper.setupTestApp();
  });

  afterAll(async () => {
    if (previousFlag === undefined) {
      delete process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED;
    } else {
      process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED = previousFlag;
    }
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  it('profile reports inbox disabled; responsible-manager-tasks API is forbidden', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const sponsorUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'sponsor-ref@test.com',
      roles: [
        {
          role: 'SPONSOR_REF_TEST',
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    await prisma.user.update({
      where: { id: sponsorUser.id },
      data: { externalId: SPONSOR_REF, externalProvider: 'HCM' },
    });

    const { token } = await TestHelper.login('sponsor-ref@test.com');

    const profile = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.responsibleManagerAccountabilityInboxEnabled).toBe(false);

    await request(app.getHttpServer())
      .get('/responsible-manager-tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('does not apply sponsor row scope on contractors when inbox disabled', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Ref Supplier',
        email: 'ref-supplier@test.com',
        country: 'ZA',
      },
    });

    const sponsored = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Sponsored',
        lastName: 'One',
        email: 'sponsored-ref@test.com',
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
      },
    });

    const unsponsored = await prisma.contractor.create({
      data: {
        supplierId: supplier.id,
        firstName: 'Unsponsored',
        lastName: 'Two',
        email: 'unsponsored-ref@test.com',
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
        contractNumber: 'REF-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Ref MSA',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.contractorEngagement.create({
      data: {
        contractorId: sponsored.id,
        contractId: contract.id,
        role: 'Dev',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 1000,
        responsibleManagerEmployeeId: SPONSOR_REF,
      },
    });

    await prisma.contractorEngagement.create({
      data: {
        contractorId: unsponsored.id,
        contractId: contract.id,
        role: 'Other',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 1000,
      },
    });

    const sponsorUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'responsible-manager-scope-off@test.com',
      roles: [
        {
          role: 'SPONSOR_SCOPE_OFF',
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    await prisma.user.update({
      where: { id: sponsorUser.id },
      data: { externalId: SPONSOR_REF, externalProvider: 'HCM' },
    });

    const { token } = await TestHelper.login('responsible-manager-scope-off@test.com');

    const res = await request(app.getHttpServer())
      .get('/contractors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const emails = res.body.data.map((c: { email: string }) => c.email);
    expect(emails).toContain(sponsored.email);
    expect(emails).toContain(unsponsored.email);
    expect(res.body.total).toBe(2);
  });
});
