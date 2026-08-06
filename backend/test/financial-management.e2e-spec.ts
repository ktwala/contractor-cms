import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
    const setup = await TestHelper.setupTestData([
      {
        role: 'CMS_ADMIN',
        permissions: [
          '*:*',
          'invoice-amounts:view',
          'invoice-payment-status:view',
          'invoices:approve',
          'invoices:export',
        ],
        orgId: null,
        isSystemRole: true,
      },
    ]);
    organization = setup.organization;
    user = setup.user;
    token = setup.token;

    // Create base entities
    supplier = await DataFactory.createSupplier(TestHelper.getPrisma(), {
      organizationId: organization.id,
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

    engagement = await TestHelper.getPrisma().contractorEngagement.create({
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

    project = await TestHelper.getPrisma().project.create({
      data: {
        organizationId: organization.id,
        ...DataFactory.project(),
      },
    });

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
              hours: 40,
              description: 'Work',
            },
          ],
        },
        totalHours: 40,
        status: 'APPROVED',
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
    beforeEach(async () => {
      await TestHelper.getPrisma().timesheet.updateMany({
        data: { invoiceId: null },
      });
      await TestHelper.getPrisma().invoice.deleteMany();
    });

    describe('POST /invoices/generate-from-timesheets', () => {
      it('should create an invoice from approved timesheets', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);

        const response = await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(201);

        expect(response.body).toMatchObject({
          invoiceNumber: invoiceDto.invoiceNumber,
          status: 'DRAFT',
        });
        expect(Number(response.body.totalAmount)).toBeGreaterThan(0);
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should handle simultaneous generateFromTimesheets requests concurrency safely', async () => {
        const invoiceDto1 = DataFactory.invoice([timesheet.id], { invoiceNumber: 'INV-CONC-1' });
        const invoiceDto2 = DataFactory.invoice([timesheet.id], { invoiceNumber: 'INV-CONC-2' });

        // Send two simultaneous requests
        const results = await Promise.allSettled([
          request(app.getHttpServer())
            .post('/invoices/generate-from-timesheets')
            .set('Authorization', `Bearer ${token}`)
            .send(invoiceDto1),
          request(app.getHttpServer())
            .post('/invoices/generate-from-timesheets')
            .set('Authorization', `Bearer ${token}`)
            .send(invoiceDto2),
        ]);

        const succeeded = results.filter(
          (r) => r.status === 'fulfilled' && r.value.status === 201
        );
        const failed = results.filter(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 201)
        );

        expect(succeeded).toHaveLength(1);
        expect(failed).toHaveLength(1);

        const failedResponse = (failed[0] as PromiseFulfilledResult<any>).value;
        expect(failedResponse.status).toBe(409); // ConflictException

        // Exactly one invoice should exist in database
        const invoices = await TestHelper.getPrisma().invoice.findMany();
        expect(invoices).toHaveLength(1);

        // Every timesheet points to that single invoice
        const updatedTimesheet = await TestHelper.getPrisma().timesheet.findUnique({
          where: { id: timesheet.id },
        });
        expect(updatedTimesheet!.invoiceId).toBe(invoices[0].id);
      });

      it('should calculate invoice total from timesheets', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);

        const response = await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(201);

        // Total should be based on hours * rate (40 hours * 1000 = 40000) plus 15% VAT (6000) = 46000
        expect(Number(response.body.totalAmount)).toBe(46000);
        expect(Number(response.body.subtotal)).toBe(40000);
      });

      it('should fail with non-approved timesheet', async () => {
        const draftTimesheet = await TestHelper.getPrisma().timesheet.create({
          data: {
            contractorId: contractor.id,
            projectId: project.id,
            periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
            totalHours: 0,
            status: 'DRAFT',
          },
        });

        const invoiceDto = DataFactory.invoice([draftTimesheet.id]);

        await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto)
          .expect(400);
      });

      it('should fail with already invoiced timesheet', async () => {
        // Create first invoice
        const invoiceDto1 = DataFactory.invoice([timesheet.id]);
        await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto1);

        // Try to create another invoice with same timesheet
        const invoiceDto2 = DataFactory.invoice([timesheet.id], {
          invoiceNumber: `INV-${Date.now() + 1}`,
        });

        await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto2)
          .expect(409);
      });
    });

    describe('GET /invoices', () => {
      it('should list invoices', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);

        const response = await request(app.getHttpServer())
          .get('/invoices')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);

        const response = await request(app.getHttpServer())
          .get('/invoices?status=DRAFT')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((i: any) => i.status === 'DRAFT')).toBe(true);
      });
    });

    describe('Invoice Status Updates', () => {
      let invoice: any;

      beforeEach(async () => {
        const invoiceDto = DataFactory.invoice([timesheet.id]);
        const response = await request(app.getHttpServer())
          .post('/invoices/generate-from-timesheets')
          .set('Authorization', `Bearer ${token}`)
          .send(invoiceDto);
        invoice = response.body;
      });

      it('should mark invoice as paid', async () => {
        // Submit first
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/submit`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Approve
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/approve`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const paymentDto = {
          paymentReference: 'PAY-12345',
          paidAt: new Date().toISOString(),
        };

        const response = await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/pay`)
          .set('Authorization', `Bearer ${token}`)
          .send(paymentDto)
          .expect(200);

        expect(response.body.status).toBe('PAID');
        expect(response.body.paidAt).toBeDefined();
        expect(response.body.paymentReference).toBe(paymentDto.paymentReference);
      });

      it('should mark invoice as void', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/cancel`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.status).toBe('CANCELLED');
      });

      it('should not mark paid invoice as void', async () => {
        // Submit first
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/submit`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Approve
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/approve`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Mark as paid first
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/pay`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            paymentReference: 'PAY-12345',
            paidAt: new Date().toISOString(),
          });

        // Try to mark as void
        await request(app.getHttpServer())
          .patch(`/invoices/${invoice.id}/cancel`)
          .set('Authorization', `Bearer ${token}`)
          .expect(400);
      });
    });

    describe('GET /invoices/:id/pdf', () => {
      it.skip('should generate invoice PDF [BACKLOG-INV-PDF-1]', async () => {});
    });
  });

  describe('Tax Classification Module', () => {
    describe('POST /tax-classifications', () => {
      it('should create a tax classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);

        const response = await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractorId: contractor.id,
          classification: taxDto.classification,
          basis: taxDto.basis,
        });
        expect(response.body.riskScore).toBe(taxDto.riskScore);
      });

      it('should calculate risk score from factors', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id, {
          assessmentPayload: {
            controlFactor: 'HIGH',
            integrationFactor: 'HIGH',
            economicRealityFactor: 'HIGH',
          },
        });

        const response = await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto)
          .expect(201);

        expect(response.body.riskScore).toBeGreaterThan(0);
      });
    });

    describe('GET /tax-classifications', () => {
      it('should list tax classifications', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by contractor', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get(`/tax-classifications?contractorId=${contractor.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((t: any) => t.contractorId === contractor.id)).toBe(true);
      });

      it('should filter by classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id, {
          classification: 'DEEMED_EMPLOYEE',
        });
        await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const response = await request(app.getHttpServer())
          .get('/tax-classifications?classification=DEEMED_EMPLOYEE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(
          response.body.data.every((t: any) => t.classification === 'DEEMED_EMPLOYEE'),
        ).toBe(true);
      });
    });

    describe('PATCH /tax-classifications/:id', () => {
      it('should update tax classification', async () => {
        const taxDto = DataFactory.taxClassification(contractor.id);
        const createResponse = await request(app.getHttpServer())
          .post('/tax-classifications')
          .set('Authorization', `Bearer ${token}`)
          .send(taxDto);

        const updateDto = {
          notes: 'Updated notes field',
          riskScore: 50,
        };

        const response = await request(app.getHttpServer())
          .patch(`/tax-classifications/${createResponse.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.notes).toBe('Updated notes field');
        expect(response.body.riskScore).toBe(50);
      });
    });

    describe('GET /tax-classifications/:id/assessment', () => {
      it.skip('should get tax assessment recommendation [BACKLOG-TAX-REC-1]', async () => {});
    });
  });
});
