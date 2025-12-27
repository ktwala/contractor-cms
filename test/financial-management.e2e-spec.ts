import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

describe('Financial Management (Phase 4) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;
  let supplier: any;
  let contractor: any;
  let contract: any;
  let engagement: any;
  let project: any;
  let timesheet: any;

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

    engagement = await TestHelper.getPrisma().engagement.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.engagement(contract.id),
      },
    });

    project = await TestHelper.getPrisma().project.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.project(),
      },
    });

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
            hours: 40,
            description: 'Work',
          },
        ],
        totalHours: 40,
        status: 'APPROVED',
        createdBy: user.id,
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('Invoices Module', () => {
    describe('POST /invoices', () => {
      it('should create an invoice from approved timesheets', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);

        const response = await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(201);

        expect(response.body).toMatchObject({
          invoiceNumber: invoiceDto.invoiceNumber,
          status: invoiceDto.status,
        });
        expect(response.body.totalAmount).toBeGreaterThan(0);
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should calculate invoice total from timesheets', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);

        const response = await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(201);

        // Total should be based on hours * rate (40 hours * 1000 = 40000)
        expect(response.body.totalAmount).toBe(40000);
      });

      it('should fail with non-approved timesheet', async () => {
        const draftTimesheet = await TestHelper.getPrisma().timesheet.create({
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

        const invoiceDto = DataFactory.invoice([draftTimesheet.id]);

        await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(400);
      });

      it('should fail with already invoiced timesheet', async () => {
        // Create first invoice
        const invoiceDto1 = DataFactory.invoice([timesheet.id]);
        await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto1);

        // Try to create another invoice with same timesheet
        const invoiceDto2 = DataFactory.invoice([timesheet.id], {
          invoiceNumber: `INV-${Date.now() + 1}`,
        });

        await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto2)
          .expect(400);
      });
    });

    describe('GET /invoices', () => {
      it('should list invoices', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);

        const response = await request(app.getHttpServer())
          .get('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id], { status: 'PENDING' });
        await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);

        const response = await request(app.getHttpServer())
          .get('/invoices?status=PENDING')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((i: any) => i.status === 'PENDING')).toBe(true);
      });
    });

    describe('Invoice Status Updates', () => {
      let invoice: any;

      beforeEach(async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        const response = await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);
        invoice = response.body;
      });

      it('should mark invoice as paid', async () => {
        const paymentDto = {
          paymentDate: new Date().toISOString(),
          paymentReference: 'PAY-12345',
          paymentAmount: invoice.totalAmount,
        };

        const response = await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/mark-paid`)
          .set('Authorization', `Bearer ${token}`)
          .send(paymentDto)
          .expect(200);

        expect(response.body.status).toBe('PAID');
        expect(response.body.paidAt).toBeDefined();
        expect(response.body.paymentReference).toBe(paymentDto.paymentReference);
      });

      it('should mark invoice as void', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/mark-void`)
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Duplicate invoice' })
          .expect(200);

        expect(response.body.status).toBe('VOID');
      });

      it('should not mark paid invoice as void', async () => {
        // Mark as paid first
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/mark-paid`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            paymentDate: new Date().toISOString(),
            paymentReference: 'PAY-12345',
            paymentAmount: invoice.totalAmount,
          });

        // Try to mark as void
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/mark-void`)
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Test' })
          .expect(400);
      });
    });

    describe('GET /invoices/:id/pdf', () => {
      it('should generate invoice PDF', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        const invoiceResponse = await request(app.getHttpServer())
          .post('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);

        const response = await request(app.getHttpServer())
          .get(`/invoices/${invoiceResponse.body.id}/pdf`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('application/pdf');
      });
    });
  });

  describe('Tax Classification Module', () => {
    describe('POST /tax-classification', () => {
      it('should create a tax classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);

        const response = await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractorId: contractor.id,
          classification: taxDto.classification,
          taxYear: taxDto.taxYear,
          status: taxDto.status,
        });
        expect(response.body.riskScore).toBe(taxDto.riskScore);
      });

      it('should calculate risk score from factors', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id, {
          factors: {
            controlFactor: 'HIGH',
            integrationFactor: 'HIGH',
            economicRealityFactor: 'HIGH',
          },
        });

        const response = await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto)
          .expect(201);

        expect(response.body.riskScore).toBeGreaterThan(0);
      });
    });

    describe('GET /tax-classification', () => {
      it('should list tax classifications', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by contractor', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get(`/tax-classification?contractorId=${contractor.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((t: any) => t.contractorId === contractor.id)).toBe(true);
      });

      it('should filter by classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id, {
          classification: 'DEEMED_EMPLOYEE',
        });
        await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get('/tax-classification?classification=DEEMED_EMPLOYEE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(
          response.body.data.every((t: any) => t.classification === 'DEEMED_EMPLOYEE'),
        ).toBe(true);
      });
    });

    describe('PATCH /tax-classification/:id', () => {
      it('should update tax classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        const createResponse = await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const updateDto = {
          status: 'INACTIVE',
          riskScore: 50,
        };

        const response = await request(app.getHttpServer())
          .patch(`/tax-classification/${createResponse.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.status).toBe('INACTIVE');
        expect(response.body.riskScore).toBe(50);
      });
    });

    describe('GET /tax-classification/:id/assessment', () => {
      it('should get tax assessment recommendation', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        const createResponse = await request(app.getHttpServer())
          .post('/tax-classification')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get(`/tax-classification/${createResponse.body.id}/assessment`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('recommendation');
        expect(response.body).toHaveProperty('riskLevel');
        expect(response.body).toHaveProperty('factors');
      });
    });
  });
});
