import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

describe('Experience Layer (Phase 6) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    const setup = await TestHelper.setupTestData();
    organization = setup.organization;
    user = setup.user;
    token = setup.token;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('Organizations Module', () => {
    describe('POST /organizations', () => {
      it('should create an organization', async () => {
        const orgDto = DataFactory.organization();

        const response = await request(app.getHttpServer())
          .post('/organizations')
          .set('Authorization', `Bearer ${token}`)
          .send(orgDto)
          .expect(201);

        expect(response.body).toMatchObject({
          name: orgDto.name,
          code: orgDto.code,
          country: orgDto.country,
          currency: orgDto.currency,
        });
        expect(response.body).toHaveProperty('id');
      });

      it('should create organization with HCM config', async () => {
        const orgDto = DataFactory.organization({
          hcmType: 'SAP_SF',
          hcmConfig: {
            apiUrl: 'https://sap.example.com',
            companyId: 'COMP123',
          },
        });

        const response = await request(app.getHttpServer())
          .post('/organizations')
          .set('Authorization', `Bearer ${token}`)
          .send(orgDto)
          .expect(201);

        expect(response.body.hcmType).toBe('SAP_SF');
        expect(response.body.hcmConfig).toMatchObject({
          apiUrl: 'https://sap.example.com',
          companyId: 'COMP123',
        });
      });

      it('should validate unique organization code', async () => {
        const orgDto = DataFactory.organization();

        // Create first organization
        await request(app.getHttpServer())
          .post('/organizations')
          .set('Authorization', `Bearer ${token}`)
          .send(orgDto);

        // Try to create duplicate
        await request(app.getHttpServer())
          .post('/organizations')
          .set('Authorization', `Bearer ${token}`)
          .send(orgDto)
          .expect(400);
      });
    });

    describe('GET /organizations', () => {
      it('should list organizations', async () => {
        const response = await request(app.getHttpServer())
          .get('/organizations')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // At least the setup organization should exist
        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should paginate organizations', async () => {
        // Create additional organizations
        for (let i = 0; i < 3; i++) {
          await TestHelper.getPrisma().organization.create({
            data: DataFactory.organization({
              code: `TEST-ORG-${Date.now()}-${i}`,
            }),
          });
        }

        const response = await request(app.getHttpServer())
          .get('/organizations?page=1&limit=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeLessThanOrEqual(2);
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('totalPages');
      });
    });

    describe('GET /organizations/:id', () => {
      it('should get organization by id', async () => {
        const response = await request(app.getHttpServer())
          .get(`/organizations/${organization.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.id).toBe(organization.id);
        expect(response.body.name).toBe(organization.name);
      });

      it('should return 404 for non-existent organization', async () => {
        await request(app.getHttpServer())
          .get('/organizations/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      });
    });

    describe('PATCH /organizations/:id', () => {
      it('should update organization', async () => {
        const updateDto = {
          name: 'Updated Organization Name',
          timezone: 'Europe/London',
        };

        const response = await request(app.getHttpServer())
          .patch(`/organizations/${organization.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.name).toBe(updateDto.name);
        expect(response.body.timezone).toBe(updateDto.timezone);
      });
    });

    describe('PATCH /organizations/:id/settings', () => {
      it('should update HCM settings', async () => {
        const settingsDto = {
          hcmConfig: {
            apiUrl: 'https://updated-api.example.com',
            apiKey: 'new-api-key',
            enableSync: true,
          },
        };

        const response = await request(app.getHttpServer())
          .patch(`/organizations/${organization.id}/settings`)
          .set('Authorization', `Bearer ${token}`)
          .send(settingsDto)
          .expect(200);

        expect(response.body.hcmConfig).toMatchObject(settingsDto.hcmConfig);
      });
    });

    describe('DELETE /organizations/:id', () => {
      it('should delete organization', async () => {
        const org = await TestHelper.getPrisma().organization.create({
          data: DataFactory.organization(),
        });

        await request(app.getHttpServer())
          .delete(`/organizations/${org.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(204);

        // Verify deletion
        const deleted = await TestHelper.getPrisma().organization.findUnique({
          where: { id: org.id },
        });
        expect(deleted).toBeNull();
      });
    });
  });

  describe('Analytics Module', () => {
    beforeEach(async () => {
      // Create test data for analytics
      const supplier = await TestHelper.getPrisma().supplier.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.supplier(),
        },
      });

      const contractor = await TestHelper.getPrisma().contractor.create({
        data: DataFactory.contractor(supplier.id),
      });

      const contract = await TestHelper.getPrisma().contract.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.contract(contractor.id, supplier.id),
        },
      });

      const engagement = await TestHelper.getPrisma().engagement.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.engagement(contract.id),
        },
      });

      const project = await TestHelper.getPrisma().project.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.project({ budget: 100000 }),
        },
      });

      const timesheet = await TestHelper.getPrisma().timesheet.create({
        data: {
          organizationId: organization.id,
          engagementId: engagement.id,
          projectId: project.id,
          periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          periodEnd: new Date(),
          entries: [{ date: new Date().toISOString().split('T')[0], hours: 40, description: 'Work' }],
          totalHours: 40,
          status: 'APPROVED',
          createdBy: user.id,
          approvedAt: new Date(),
          approvedBy: user.id,
        },
      });

      await TestHelper.getPrisma().invoice.create({
        data: {
          organizationId: organization.id,
          supplierId: supplier.id,
          invoiceNumber: `INV-${Date.now()}`,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal: 40000,
          tax: 0,
          totalAmount: 40000,
          currency: 'ZAR',
          status: 'PAID',
          timesheets: {
            connect: [{ id: timesheet.id }],
          },
          createdBy: user.id,
          paidAt: new Date(),
        },
      });

      const taxClassification = await TestHelper.getPrisma().contractorTaxClassification.create({
        data: {
          contractorId: contractor.id,
          taxYear: new Date().getFullYear(),
          classification: 'DEEMED_EMPLOYEE',
          determinationDate: new Date(),
          factors: {},
          riskScore: 75,
          status: 'ACTIVE',
        },
      });

      await TestHelper.getPrisma().withholdingInstruction.create({
        data: {
          organizationId: organization.id,
          contractorId: contractor.id,
          taxClassificationId: taxClassification.id,
          instructionNumber: `WH-${Date.now()}`,
          effectiveDate: new Date(),
          workerName: `${contractor.firstName} ${contractor.lastName}`,
          supplierName: `${supplier.firstName} ${supplier.lastName}`,
          withholdingType: 'PAYE',
          taxYear: new Date().getFullYear(),
          grossAmount: 40000,
          withholdingAmount: 10400,
          netAmount: 29600,
          currency: 'ZAR',
          classification: 'DEEMED_EMPLOYEE',
          canonicalPayload: {},
          syncStatus: 'SYNCED',
          retryCount: 0,
          createdBy: user.id,
        },
      });
    });

    describe('GET /analytics/dashboard', () => {
      it('should get comprehensive dashboard analytics', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/dashboard')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('financial');
        expect(response.body).toHaveProperty('contractors');
        expect(response.body).toHaveProperty('projects');
        expect(response.body).toHaveProperty('timesheets');
        expect(response.body).toHaveProperty('tax');
      });

      it('should filter analytics by date range', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        const response = await request(app.getHttpServer())
          .get(`/analytics/dashboard?startDate=${startDate}&endDate=${endDate}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('financial');
        expect(response.body.financial).toHaveProperty('totalInvoiced');
      });
    });

    describe('GET /analytics/financial', () => {
      it('should get financial summary', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/financial')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalInvoiced');
        expect(response.body).toHaveProperty('totalPaid');
        expect(response.body).toHaveProperty('totalPending');
        expect(response.body).toHaveProperty('invoiceCount');
        expect(response.body).toHaveProperty('averageInvoiceAmount');

        expect(response.body.totalInvoiced).toBeGreaterThan(0);
        expect(response.body.totalPaid).toBeGreaterThan(0);
        expect(response.body.invoiceCount).toBeGreaterThan(0);
      });
    });

    describe('GET /analytics/contractors', () => {
      it('should get contractor summary', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/contractors')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalContractors');
        expect(response.body).toHaveProperty('activeContractors');
        expect(response.body).toHaveProperty('inactiveContractors');
        expect(response.body).toHaveProperty('activeEngagements');
        expect(response.body).toHaveProperty('supplierCount');

        expect(response.body.totalContractors).toBeGreaterThan(0);
        expect(response.body.supplierCount).toBeGreaterThan(0);
      });
    });

    describe('GET /analytics/projects', () => {
      it('should get project summary', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/projects')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalProjects');
        expect(response.body).toHaveProperty('activeProjects');
        expect(response.body).toHaveProperty('completedProjects');
        expect(response.body).toHaveProperty('totalBudget');
        expect(response.body).toHaveProperty('totalUtilized');
        expect(response.body).toHaveProperty('averageUtilization');

        expect(response.body.totalProjects).toBeGreaterThan(0);
        expect(response.body.totalBudget).toBeGreaterThan(0);
      });
    });

    describe('GET /analytics/timesheets', () => {
      it('should get timesheet summary', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/timesheets')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalTimesheets');
        expect(response.body).toHaveProperty('pendingApproval');
        expect(response.body).toHaveProperty('approved');
        expect(response.body).toHaveProperty('rejected');
        expect(response.body).toHaveProperty('totalHours');

        expect(response.body.totalTimesheets).toBeGreaterThan(0);
        expect(response.body.totalHours).toBeGreaterThan(0);
      });
    });

    describe('GET /analytics/tax', () => {
      it('should get tax withholding summary', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/tax')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalWithheld');
        expect(response.body).toHaveProperty('payeWithheld');
        expect(response.body).toHaveProperty('sdlWithheld');
        expect(response.body).toHaveProperty('uifWithheld');
        expect(response.body).toHaveProperty('instructionCount');

        expect(response.body.totalWithheld).toBeGreaterThan(0);
        expect(response.body.instructionCount).toBeGreaterThan(0);
      });

      it('should break down withholding by type', async () => {
        const response = await request(app.getHttpServer())
          .get('/analytics/tax')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // We created a PAYE instruction
        expect(response.body.payeWithheld).toBeGreaterThan(0);
      });
    });
  });
});
