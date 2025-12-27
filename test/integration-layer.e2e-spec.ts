import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

describe('Integration Layer (Phase 5) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;
  let supplier: any;
  let contractor: any;
  let taxClassification: any;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    const setup = await TestHelper.setupTestData();
    organization = setup.organization;
    user = setup.user;
    token = setup.token;

    supplier = await TestHelper.getPrisma().supplier.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.supplier(),
      },
    });

    contractor = await TestHelper.getPrisma().contractor.create({
      data: DataFactory.contractor(supplier.id),
    });

    taxClassification = await TestHelper.getPrisma().contractorTaxClassification.create({
      data: {
        contractorId: contractor.id,
        taxYear: new Date().getFullYear(),
        classification: 'DEEMED_EMPLOYEE',
        determinationDate: new Date(),
        factors: {
          controlFactor: 'HIGH',
          integrationFactor: 'HIGH',
          economicRealityFactor: 'MEDIUM',
        },
        riskScore: 75,
        dominantImpression: 'Employment relationship exists',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('Projects Module', () => {
    describe('POST /projects', () => {
      it('should create a project', async () => {
        const projectDto = DataFactory.project();

        const response = await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send(projectDto)
          .expect(201);

        expect(response.body).toMatchObject({
          code: projectDto.code,
          name: projectDto.name,
          status: projectDto.status,
        });
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should create project with budget', async () => {
        const projectDto = DataFactory.project({ budget: 500000 });

        const response = await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send(projectDto)
          .expect(201);

        expect(response.body.budget).toBe(500000);
      });

      it('should validate unique project code', async () => {
        const projectDto = DataFactory.project();

        // Create first project
        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send(projectDto);

        // Try to create duplicate
        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send(projectDto)
          .expect(400);
      });
    });

    describe('GET /projects', () => {
      it('should list projects', async () => {
        await TestHelper.getPrisma().project.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.project(),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/projects')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        await TestHelper.getPrisma().project.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.project({ status: 'ACTIVE' }),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/projects?status=ACTIVE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((p: any) => p.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('GET /projects/:id/budget-utilization', () => {
      it('should get budget utilization', async () => {
        const project = await TestHelper.getPrisma().project.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.project({ budget: 100000 }),
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/projects/${project.id}/budget-utilization`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('budget');
        expect(response.body).toHaveProperty('totalInvoiced');
        expect(response.body).toHaveProperty('budgetRemaining');
        expect(response.body).toHaveProperty('utilizationPercentage');
      });

      it('should calculate utilization from invoices', async () => {
        const project = await TestHelper.getPrisma().project.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.project({ budget: 100000 }),
          },
        });

        // Create engagement and timesheet
        const contract = await TestHelper.getPrisma().contract.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.contract(contractor.id, supplier.id),
          },
        });

        const engagement = await TestHelper.getPrisma().engagement.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.engagement(contract.id, { rate: 1000 }),
          },
        });

        const timesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            organizationId: organization.id,
            engagementId: engagement.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            entries: [{ date: new Date().toISOString().split('T')[0], hours: 10, description: 'Work' }],
            totalHours: 10,
            status: 'APPROVED',
            createdBy: user.id,
            approvedAt: new Date(),
            approvedBy: user.id,
          },
        });

        // Create invoice
        await TestHelper.getPrisma().invoice.create({
          data: {
            organizationId: organization.id,
            supplierId: supplier.id,
            invoiceNumber: `INV-${Date.now()}`,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subtotal: 10000,
            tax: 0,
            totalAmount: 10000,
            currency: 'ZAR',
            status: 'PENDING',
            timesheets: {
              connect: [{ id: timesheet.id }],
            },
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/projects/${project.id}/budget-utilization`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.totalInvoiced).toBe(10000);
        expect(response.body.budgetRemaining).toBe(90000);
        expect(response.body.utilizationPercentage).toBe(10);
      });
    });

    describe('PATCH /projects/:id', () => {
      it('should update project', async () => {
        const project = await TestHelper.getPrisma().project.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.project(),
          },
        });

        const updateDto = {
          status: 'COMPLETED',
          budget: 150000,
        };

        const response = await request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.status).toBe('COMPLETED');
        expect(response.body.budget).toBe(150000);
      });
    });
  });

  describe('Withholding Instructions Module', () => {
    describe('POST /withholding-instructions', () => {
      it('should create a withholding instruction', async () => {
        const withholdingDto = DataFactory.withholdingInstruction(
          contractor.id,
          taxClassification.id,
        );

        const response = await request(app.getHttpServer())
          .post('/withholding-instructions')
          .set('Authorization', `Bearer ${token}`)
          .send(withholdingDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractorId: contractor.id,
          taxClassificationId: taxClassification.id,
          withholdingType: withholdingDto.withholdingType,
        });
        expect(response.body).toHaveProperty('instructionNumber');
        expect(response.body.syncStatus).toBe('PENDING');
      });

      it('should calculate PAYE withholding', async () => {
        const withholdingDto = DataFactory.withholdingInstruction(
          contractor.id,
          taxClassification.id,
          {
            withholdingType: 'PAYE',
            grossAmount: 25000,
            withholdingAmount: 6500, // 26% for this bracket
          },
        );

        const response = await request(app.getHttpServer())
          .post('/withholding-instructions')
          .set('Authorization', `Bearer ${token}`)
          .send(withholdingDto)
          .expect(201);

        expect(response.body.grossAmount).toBe(25000);
        expect(response.body.withholdingAmount).toBe(6500);
        expect(response.body.netAmount).toBe(18500);
      });

      it('should calculate SDL withholding (1%)', async () => {
        const grossAmount = 25000;
        const withholdingAmount = grossAmount * 0.01; // 1%

        const withholdingDto = DataFactory.withholdingInstruction(
          contractor.id,
          taxClassification.id,
          {
            withholdingType: 'SDL',
            grossAmount,
            withholdingAmount,
          },
        );

        const response = await request(app.getHttpServer())
          .post('/withholding-instructions')
          .set('Authorization', `Bearer ${token}`)
          .send(withholdingDto)
          .expect(201);

        expect(response.body.withholdingAmount).toBe(250);
      });

      it('should calculate UIF withholding (1% capped)', async () => {
        const grossAmount = 20000;
        const cappedAmount = Math.min(grossAmount, 17712);
        const withholdingAmount = cappedAmount * 0.01;

        const withholdingDto = DataFactory.withholdingInstruction(
          contractor.id,
          taxClassification.id,
          {
            withholdingType: 'UIF',
            grossAmount,
            withholdingAmount,
          },
        );

        const response = await request(app.getHttpServer())
          .post('/withholding-instructions')
          .set('Authorization', `Bearer ${token}`)
          .send(withholdingDto)
          .expect(201);

        expect(response.body.withholdingAmount).toBe(177.12);
      });
    });

    describe('GET /withholding-instructions', () => {
      it('should list withholding instructions', async () => {
        await TestHelper.getPrisma().withholdingInstruction.create({
          data: {
            organizationId: organization.id,
            contractorId: contractor.id,
            taxClassificationId: taxClassification.id,
            instructionNumber: `WH-${Date.now()}`,
            effectiveDate: new Date(),
            workerName: `${contractor.firstName} ${contractor.lastName}`,
            workerTaxNumber: contractor.taxNumber,
            supplierName: `${supplier.firstName} ${supplier.lastName}`,
            supplierTaxNumber: supplier.taxNumber,
            withholdingType: 'PAYE',
            taxYear: new Date().getFullYear(),
            grossAmount: 25000,
            withholdingAmount: 6500,
            netAmount: 18500,
            currency: 'ZAR',
            classification: 'DEEMED_EMPLOYEE',
            canonicalPayload: {},
            syncStatus: 'PENDING',
            retryCount: 0,
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/withholding-instructions')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by withholding type', async () => {
        await TestHelper.getPrisma().withholdingInstruction.create({
          data: {
            organizationId: organization.id,
            contractorId: contractor.id,
            taxClassificationId: taxClassification.id,
            instructionNumber: `WH-${Date.now()}`,
            effectiveDate: new Date(),
            workerName: `${contractor.firstName} ${contractor.lastName}`,
            supplierName: `${supplier.firstName} ${supplier.lastName}`,
            withholdingType: 'SDL',
            taxYear: new Date().getFullYear(),
            grossAmount: 25000,
            withholdingAmount: 250,
            netAmount: 24750,
            currency: 'ZAR',
            classification: 'DEEMED_EMPLOYEE',
            canonicalPayload: {},
            syncStatus: 'PENDING',
            retryCount: 0,
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/withholding-instructions?withholdingType=SDL')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((w: any) => w.withholdingType === 'SDL')).toBe(true);
      });

      it('should filter by sync status', async () => {
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
            grossAmount: 25000,
            withholdingAmount: 6500,
            netAmount: 18500,
            currency: 'ZAR',
            classification: 'DEEMED_EMPLOYEE',
            canonicalPayload: {},
            syncStatus: 'SYNCED',
            retryCount: 0,
            createdBy: user.id,
          },
        });

        const response = await request(app.getHttpServer())
          .get('/withholding-instructions?syncStatus=SYNCED')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((w: any) => w.syncStatus === 'SYNCED')).toBe(true);
      });
    });

    describe('Withholding Sync Operations', () => {
      let instruction: any;

      beforeEach(async () => {
        instruction = await TestHelper.getPrisma().withholdingInstruction.create({
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
            grossAmount: 25000,
            withholdingAmount: 6500,
            netAmount: 18500,
            currency: 'ZAR',
            classification: 'DEEMED_EMPLOYEE',
            canonicalPayload: {},
            syncStatus: 'PENDING',
            retryCount: 0,
            createdBy: user.id,
          },
        });
      });

      it('should mark instruction as synced', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/withholding-instructions/${instruction.id}/mark-synced`)
          .set('Authorization', `Bearer ${token}`)
          .send({ externalReference: 'EXT-12345' })
          .expect(200);

        expect(response.body.syncStatus).toBe('SYNCED');
        expect(response.body.externalReference).toBe('EXT-12345');
        expect(response.body.syncedAt).toBeDefined();
      });

      it('should mark instruction as failed', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/withholding-instructions/${instruction.id}/mark-failed`)
          .set('Authorization', `Bearer ${token}`)
          .send({ error: 'HCM connection timeout' })
          .expect(200);

        expect(response.body.syncStatus).toBe('FAILED');
        expect(response.body.syncError).toBe('HCM connection timeout');
        expect(response.body.retryCount).toBe(1);
      });
    });

    describe('PATCH /withholding-instructions/:id', () => {
      it('should update withholding instruction', async () => {
        const instruction = await TestHelper.getPrisma().withholdingInstruction.create({
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
            grossAmount: 25000,
            withholdingAmount: 6500,
            netAmount: 18500,
            currency: 'ZAR',
            classification: 'DEEMED_EMPLOYEE',
            canonicalPayload: {},
            syncStatus: 'PENDING',
            retryCount: 0,
            createdBy: user.id,
          },
        });

        const updateDto = {
          grossAmount: 30000,
          withholdingAmount: 7800,
        };

        const response = await request(app.getHttpServer())
          .patch(`/withholding-instructions/${instruction.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.grossAmount).toBe(30000);
        expect(response.body.withholdingAmount).toBe(7800);
        expect(response.body.netAmount).toBe(22200);
      });
    });
  });
});
