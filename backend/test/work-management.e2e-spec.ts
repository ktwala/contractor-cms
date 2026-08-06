import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

    await TestHelper.getPrisma().organization.update({
      where: { id: organization.id },
      data: { supplierAuthorityMode: 'ORACLE_ONLY' },
    });

    // Create base entities
    supplier = await DataFactory.createSupplier(TestHelper.getPrisma(), {
      organizationId: organization.id,
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'EXT-SUP-123',
      sourceSyncStatus: 'SYNCED',
    });

    contractor = await DataFactory.createContractor(TestHelper.getPrisma(), {
      organizationId: organization.id,
      supplierId: supplier.id,
    });

    contract = await TestHelper.getPrisma().supplierContract.create({
      data: {
        organizationId: organization.id,
        supplierId: supplier.id,
        contractNumber: `CT-${Date.now()}`,
        title: 'Dev Contract',
        contractType: 'TIME_AND_MATERIALS',
        startDate: new Date(),
        status: 'ACTIVE',
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
        const engagementDto = DataFactory.engagement(contract.id, contractor.id);

        const response = await request(app.getHttpServer())
          .post('/engagements')
          .set('Authorization', `Bearer ${token}`)
          .send(engagementDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractId: contract.id,
          role: engagementDto.role,
          isActive: true,
        });
      });

      it('should validate date range', async () => {
        const engagementDto = DataFactory.engagement(contract.id, contractor.id, {
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
        await TestHelper.getPrisma().contractorEngagement.create({
          data: {
            contractId: contract.id,
            contractorId: contractor.id,
            role: 'Engineer',
            startDate: new Date(),
            rateAmount: 1000,
            rateType: 'HOURLY',
            currency: 'ZAR',
          },
        });

        const response = await request(app.getHttpServer())
          .get('/engagements')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        await TestHelper.getPrisma().contractorEngagement.create({
          data: {
            contractId: contract.id,
            contractorId: contractor.id,
            role: 'Active Engineer',
            startDate: new Date(),
            rateAmount: 1000,
            rateType: 'HOURLY',
            currency: 'ZAR',
            isActive: true,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/engagements?isActive=true')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((e: any) => e.isActive === true)).toBe(true);
      });
    });

    describe('PATCH /engagements/:id', () => {
      it('should update engagement', async () => {
        const engagement = await TestHelper.getPrisma().contractorEngagement.create({
          data: {
            contractId: contract.id,
            contractorId: contractor.id,
            role: 'Update Engineer',
            startDate: new Date(),
            rateAmount: 1000,
            rateType: 'HOURLY',
            currency: 'ZAR',
          },
        });

        const updateDto = {
          isActive: false,
        };

        const response = await request(app.getHttpServer())
          .patch(`/engagements/${engagement.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.isActive).toBe(false);
      });
    });
  });

  describe('Timesheets Module', () => {
    let engagement: any;

    beforeEach(async () => {
      engagement = await TestHelper.getPrisma().contractorEngagement.create({
        data: {
          contractId: contract.id,
          contractorId: contractor.id,
          role: 'Timesheet Engineer',
          startDate: new Date(),
          rateAmount: 1000,
          rateType: 'HOURLY',
          currency: 'ZAR',
        },
      });
    });

    describe('POST /timesheets', () => {
      it('should create a timesheet', async () => {
        const timesheetDto = DataFactory.timesheet(contractor.id, project.id);

        const response = await request(app.getHttpServer())
          .post('/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(timesheetDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractorId: contractor.id,
          projectId: project.id,
          status: 'DRAFT',
        });
        expect(Number(response.body.totalHours)).toBeGreaterThan(0);
      });

      it('should calculate total hours from entries', async () => {
        const timesheetDto = DataFactory.timesheet(contractor.id, project.id, {
          entries: [
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              hours: 5,
              description: 'Work',
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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

        expect(Number(response.body.totalHours)).toBe(8.5);
      });

      it('should validate period dates', async () => {
        const timesheetDto = DataFactory.timesheet(contractor.id, project.id, {
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
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: {
              create: [
                {
                  date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                  hours: 8,
                  description: 'Work',
                },
              ],
            },
            totalHours: 8,
            status: 'DRAFT',
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
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            totalHours: 0,
            status: 'SUBMITTED',
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
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: {
              create: [
                {
                  date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                  hours: 8,
                  description: 'Work',
                },
              ],
            },
            totalHours: 8,
            status: 'DRAFT',
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

      it('should block timesheet submission when governance evidence is untrusted and missing', async () => {
        // Create an untrusted supplier with no documents
        const untrustedSupplier = await DataFactory.createSupplier(TestHelper.getPrisma(), {
          organizationId: organization.id,
          sourceSystem: 'CMS_NATIVE',
          sourceSyncStatus: 'NOT_SYNCED',
        });

        const untrustedContractor = await DataFactory.createContractor(TestHelper.getPrisma(), {
          organizationId: organization.id,
          supplierId: untrustedSupplier.id,
        });

        // Create engagement for untrusted contractor
        await TestHelper.getPrisma().contractorEngagement.create({
          data: {
            contractorId: untrustedContractor.id,
            role: 'Dev',
            startDate: new Date(),
            rateAmount: 100,
            rateType: 'HOURLY',
            currency: 'ZAR',
            isActive: true,
          },
        });

        const untrustedTimesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            contractorId: untrustedContractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: {
              create: [
                {
                  date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                  hours: 8,
                  description: 'Work',
                },
              ],
            },
            totalHours: 8,
            status: 'DRAFT',
          },
        });

        // Submitting this timesheet should fail with 403 because supplier has no documents and is untrusted
        await request(app.getHttpServer())
          .patch(`/timesheets/${untrustedTimesheet.id}/submit`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
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
          .send({ rejectionReason: 'Incorrect hours' })
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
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            totalHours: 0,
            status: 'DRAFT',
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

        expect(Number(response.body.totalHours)).toBe(7);
      });

      it('should not update submitted timesheet', async () => {
        const timesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            totalHours: 0,
            status: 'SUBMITTED',
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
