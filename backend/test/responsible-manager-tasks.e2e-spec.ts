import { INestApplication } from '@nestjs/common';
import {
  ContractType,
  ResponsibleManagerAccountabilityStatus,
  ResponsibleManagerTaskStatus,
  ResponsibleManagerTaskType,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { TestHelper } from './utils/test-helper';

const SPONSOR_REF = 'ewp:emp:tasks-responsible-manager-a';
const OTHER_REF = 'ewp:emp:tasks-responsible-manager-b';

describe('Sponsor accountability tasks (PR-SPONSOR-TASKS-1)', () => {
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

  async function seedSponsoredPlacement(
    orgId: string,
    responsibleManagerEmployeeId: string,
    contractorEmail: string,
  ) {
    const prisma = TestHelper.getPrisma();
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Tasks Supplier',
        email: 'tasks-supplier@test.com',
        country: 'ZA',
      },
    });
    const contractor = await prisma.contractor.create({
      data: {
        organization: { connect: { id: orgId } },
        supplier: { connect: { id: supplier.id } },
        firstName: 'Task',
        lastName: 'Worker',
        email: contractorEmail,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
        accessIntent: 'ACCESS_LOGICAL',
      },
    });
    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: orgId,
        supplierId: supplier.id,
        contractNumber: `MSA-${contractorEmail}`,
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Tasks MSA',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    const engagement = await prisma.contractorEngagement.create({
      data: {
        contractorId: contractor.id,
        contractId: contract.id,
        role: 'Sponsored role',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 500,
        responsibleManagerEmployeeId,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });
    return { contractor, engagement };
  }

  async function createSponsorUser(
    orgId: string,
    email: string,
    password: string,
    externalId: string,
  ) {
    const user = await TestHelper.createUserWithRoles(orgId, {
      email,
      password,
      roles: [
        {
          role: 'SPONSOR',
          orgId,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    await TestHelper.getPrisma().user.update({
      where: { id: user.id },
      data: { externalId, externalProvider: 'HCM' },
    });
    return TestHelper.login(email, password);
  }

  it('lists and syncs open tasks scoped to sponsor HCM id', async () => {
    const org = await TestHelper.createTestOrganization();
    await seedSponsoredPlacement(org.id, SPONSOR_REF, 'tasks-a@test.com');
    const { token } = await createSponsorUser(
      org.id,
      'sponsor.tasks@test.com',
      'ResponsibleManagerTasks123!',
      SPONSOR_REF,
    );

    const res = await request(app.getHttpServer())
      .get('/responsible-manager-tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(2);
    const types = res.body.data.map((t: { taskType: string }) => t.taskType);
    expect(types).toContain(ResponsibleManagerTaskType.CERTIFICATION_READINESS);
    expect(types).toContain(ResponsibleManagerTaskType.ACCESS_NEED_CONFIRMATION);
    expect(
      res.body.data.every(
        (t: { responsibleManagerEmployeeId: string }) => t.responsibleManagerEmployeeId === SPONSOR_REF,
      ),
    ).toBe(true);
  });

  it('complete certification task updates engagement responsibleManagerStatus', async () => {
    const org = await TestHelper.createTestOrganization();
    const { engagement } = await seedSponsoredPlacement(
      org.id,
      SPONSOR_REF,
      'cert-a@test.com',
    );
    const { token } = await createSponsorUser(
      org.id,
      'sponsor.cert@test.com',
      'SponsorCert123!',
      SPONSOR_REF,
    );

    const list = await request(app.getHttpServer())
      .get('/responsible-manager-tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const certTask = list.body.data.find(
      (t: { taskType: string }) =>
        t.taskType === ResponsibleManagerTaskType.CERTIFICATION_READINESS,
    );
    expect(certTask).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/responsible-manager-tasks/${certTask.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Accountability attested' })
      .expect(200);

    const updated = await TestHelper.getPrisma().contractorEngagement.findUnique({
      where: { id: engagement.id },
    });
    expect(updated?.responsibleManagerStatus).toBe(ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ACTIVE);

    const task = await TestHelper.getPrisma().responsibleManagerAccountabilityTask.findUnique({
      where: { id: certTask.id },
    });
    expect(task?.status).toBe(ResponsibleManagerTaskStatus.COMPLETED);
  });

  it('cross-sponsor cannot read or complete another sponsor task', async () => {
    const org = await TestHelper.createTestOrganization();
    await seedSponsoredPlacement(org.id, SPONSOR_REF, 'cross-a@test.com');
    const { token: tokenA } = await createSponsorUser(
      org.id,
      'sponsor.a@test.com',
      'SponsorA123!',
      SPONSOR_REF,
    );
    const listA = await request(app.getHttpServer())
      .get('/responsible-manager-tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const taskId = listA.body.data[0]?.id;
    expect(taskId).toBeDefined();

    const { token: tokenB } = await createSponsorUser(
      org.id,
      'sponsor.b@test.com',
      'SponsorB123!',
      OTHER_REF,
    );

    await request(app.getHttpServer())
      .get(`/responsible-manager-tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/responsible-manager-tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(404);
  });

  it('returns 403 without HCM externalId', async () => {
    const org = await TestHelper.createTestOrganization();
    await TestHelper.createUserWithRoles(org.id, {
      email: 'sponsor.nohcm@test.com',
      password: 'NoHcm123!',
      roles: [
        {
          role: 'SPONSOR',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR],
          isSystemRole: true,
        },
      ],
    });
    const { token } = await TestHelper.login('sponsor.nohcm@test.com', 'NoHcm123!');

    await request(app.getHttpServer())
      .get('/responsible-manager-tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
