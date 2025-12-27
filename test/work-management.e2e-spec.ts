import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

describe('Work Management (Phase 3) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;
  let supplier: any;
  let contractor: any;
  let contract: any;
  let project: any;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    const setup = await TestHelper.setupTestData();
    organization = setup.organization;
    user = setup.user;
    token = setup.token;

    // Create base entities
    supplier = await TestHelper.getPrisma().supplier.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.supplier(),
      },
    });

    contractor = await TestHelper.getPrisma().contractor.create({
      data: DataFactory.contractor(supplier.id),
    });

    contract = await TestHelper.getPrisma().contract.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.contract(contractor.id, supplier.id),
      },
    });

    project = await TestHelper.getPrisma().project.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.project(),
      },
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('Engagements Module', () => {
    describe('POST /engagements', () => {
      it('should create an engagement', async () => {
        const engagementDto = DataFactory.engagement(contract.id);

        const response = await request(app.getHttpServer())
          .post('/engagements')
          .set('Authorization', `Bearer ${token}`)
          .send(engagementDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractId: contract.id,
          title: engagementDto.title,
          status: engagementDto.status,
        });
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should validate date range', async () => {
        const engagementDto = DataFactory.engagement(contract.id, {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() - 1000).toISOString(),
        });

        await request(app.getHttpServer())
          .post('/engagements')
          .set('Authorization', `Bearer ${token}`)
          .send(engagementDto)
          .expect(400);
      });
    });

    describe('GET /engagements', () => {
      it('should list engagements', async () => {
        await TestHelper.getPrisma().engagement.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.engagement(contract.id),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/engagements')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        await TestHelper.getPrisma().engagement.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.engagement(contract.id, { status: 'ACTIVE' }),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/engagements?status=ACTIVE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((e: any) => e.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('PATCH /engagements/:id', () => {
      it('should update engagement', async () => {
        const engagement = await TestHelper.getPrisma().engagement.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.engagement(contract.id),
          },
        });

        const updateDto = {
          status: 'COMPLETED',
        };

        const response = await request(app.getHttpServer())
          .patch(`/engagements/${engagement.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.status).toBe('COMPLETED');
      });
    });
  });

  describe('Timesheets Module', () => {
    let engagement: any;

    beforeEach(async () => {
      engagement = await TestHelper.getPrisma().engagement.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.engagement(contract.id),
        },
      });
    });

    describe('POST /timesheets', () => {
      it('should create a timesheet', async () => {
        const timesheetDto = DataFactory.timesheet(engagement.id, project.id);

        const response = await request(app.getHttpServer())
          .post('/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(timesheetDto)
          .expect(201);

        expect(response.body).toMatchObject({
          engagementId: engagement.id,
          projectId: project.id,
          status: timesheetDto.status,
        });
        expect(response.body.totalHours).toBeGreaterThan(0);
      });

      it('should calculate total hours from entries', async () => {
        const timesheetDto = DataFactory.timesheet(engagement.id, project.id, {
          entries: [
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              hours: 5,
              description: 'Work',
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              hours: 3.5,
              description: 'More work',
            },
          ],
        });

        const response = await request(app.getHttpServer())
          .post('/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(timesheetDto)
          .expect(201);

        expect(response.body.totalHours).toBe(8.5);
      });

      it('should validate period dates', async () => {
        const timesheetDto = DataFactory.timesheet(engagement.id, project.id, {
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() - 1000).toISOString(),
        });

        await request(app.getHttpServer())
          .post('/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(timesheetDto)
          .expect(400);
      });
    });

    describe('GET /timesheets', () => {
      it('should list timesheets', async () => {
        await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [
              {
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                hours: 8,
                description: 'Work',
              },
            ],
            totalHours: 8,
            status: 'DRAFT',
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [],
            totalHours: 0,
            status: 'SUBMITTED',
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/timesheets?status=SUBMITTED')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((t: any) => t.status === 'SUBMITTED')).toBe(true);
      });
    });

    describe('Timesheet Approval Workflow', () => {
      let timesheet: any;

      beforeEach(async () => {
        timesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [
              {
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                hours: 8,
                description: 'Work',
              },
            ],
            totalHours: 8,
            status: 'DRAFT',
            createdBy: user.id,
          },
        });
      });

      it('should submit timesheet', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/submit`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.status).toBe('SUBMITTED');
        expect(response.body.submittedAt).toBeDefined();
      });

      it('should approve timesheet', async () => {
        // Submit first
        await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/submit`)
          .set('Authorization', `Bearer ${token}`);

        // Then approve
        const response = await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/approve`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.status).toBe('APPROVED');
        expect(response.body.approvedAt).toBeDefined();
      });

      it('should reject timesheet with reason', async () => {
        // Submit first
        await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/submit`)
          .set('Authorization', `Bearer ${token}`);

        // Then reject
        const response = await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/reject`)
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Incorrect hours' })
          .expect(200);

        expect(response.body.status).toBe('REJECTED');
        expect(response.body.rejectionReason).toBe('Incorrect hours');
      });

      it('should not approve draft timesheet', async () => {
        await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}/approve`)
          .set('Authorization', `Bearer ${token}`)
          .expect(400);
      });
    });

    describe('PATCH /timesheets/:id', () => {
      it('should update draft timesheet', async () => {
        const timesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [],
            totalHours: 0,
            status: 'DRAFT',
            createdBy: user.id,
          },
        });

        const updateDto = {
          entries: [
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              hours: 7,
              description: 'Updated work',
            },
          ],
        };

        const response = await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.totalHours).toBe(7);
      });

      it('should not update submitted timesheet', async () => {
        const timesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [],
            totalHours: 0,
            status: 'SUBMITTED',
            createdBy: user.id,
          },
        });

        const updateDto = {
          entries: [
            {
              date: new Date().toISOString().split('T')[0],
              hours: 5,
              description: 'Work',
            },
          ],
        };

        await request(app.getHttpServer())
          .patch(`/timesheets/${timesheet.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(400);
      });
    });
  });
});
