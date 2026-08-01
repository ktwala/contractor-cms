import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SARS Tax Forms (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let taxPeriodId: string;
  let irp5Id: string;
  let emp201Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Tax Periods', () => {
    it('/api/sars/tax-periods (GET) - should return tax periods', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/sars/tax-periods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Store annual tax period for IRP5 tests
      const annualPeriod = response.body.find((p: any) => p.period_type === 'annual');
      expect(annualPeriod).toBeDefined();
      taxPeriodId = annualPeriod.id;
    });

    it('/api/sars/tax-periods (GET) - should filter by tax year', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/sars/tax-periods?tax_year=2024-2025')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((period: any) => {
        expect(period.tax_year).toBe('2024-2025');
      });
    });

    it('/api/sars/tax-periods (GET) - should filter by period type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/sars/tax-periods?period_type=monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((period: any) => {
        expect(period.period_type).toBe('monthly');
      });
    });
  });

  describe('IRP5 Certificates', () => {
    it('/api/sars/irp5/generate/:tax_period_id (POST) - should generate IRP5 certificates', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/sars/irp5/generate/${taxPeriodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('certificates_generated');
      expect(response.body.certificates_generated).toBeGreaterThanOrEqual(0);
    });

    it('/api/sars/irp5/:tax_period_id (GET) - should return IRP5 certificates', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/sars/irp5/${taxPeriodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      if (response.body.length > 0) {
        irp5Id = response.body[0].id;

        // Verify IRP5 structure
        const irp5 = response.body[0];
        expect(irp5).toHaveProperty('employee_id');
        expect(irp5).toHaveProperty('employee_number');
        expect(irp5).toHaveProperty('total_remuneration');
        expect(irp5).toHaveProperty('taxable_income');
        expect(irp5).toHaveProperty('paye_deducted');
        expect(irp5).toHaveProperty('status');
      }
    });

    it('/api/sars/irp5/:id/pdf (GET) - should download IRP5 as PDF', async () => {
      if (!irp5Id) {
        console.log('Skipping PDF test - no IRP5 certificates available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/sars/irp5/${irp5Id}/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('/api/sars/irp5/bulk/:tax_period_id/pdf (GET) - should download bulk IRP5 PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/sars/irp5/bulk/${taxPeriodId}/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('EMP201 Returns', () => {
    let monthlyPeriodId: string;

    beforeAll(async () => {
      // Get a monthly tax period for EMP201
      const response = await request(app.getHttpServer())
        .get('/api/sars/tax-periods?period_type=monthly')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.body.length > 0) {
        monthlyPeriodId = response.body[0].id;
      }
    });

    it('/api/sars/emp201/generate/:tax_period_id (POST) - should generate EMP201 return', async () => {
      if (!monthlyPeriodId) {
        console.log('Skipping EMP201 generation - no monthly periods available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/sars/emp201/generate/${monthlyPeriodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('emp201_id');
      emp201Id = response.body.emp201_id;
    });

    it('/api/sars/emp201 (GET) - should return EMP201 returns', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/sars/emp201')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      if (response.body.length > 0) {
        if (!emp201Id) {
          emp201Id = response.body[0].id;
        }

        // Verify EMP201 structure
        const emp201 = response.body[0];
        expect(emp201).toHaveProperty('tax_period_id');
        expect(emp201).toHaveProperty('total_employees');
        expect(emp201).toHaveProperty('paye_total');
        expect(emp201).toHaveProperty('uif_total');
        expect(emp201).toHaveProperty('sdl_total');
        expect(emp201).toHaveProperty('total_liability');
        expect(emp201).toHaveProperty('status');
      }
    });

    it('/api/sars/emp201/:id/csv (GET) - should download EMP201 as CSV', async () => {
      if (!emp201Id) {
        console.log('Skipping CSV test - no EMP201 returns available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/sars/emp201/${emp201Id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('EMP201');
      expect(response.text).toContain('Total PAYE');
    });

    it('/api/sars/emp201/:id/efiling-csv (GET) - should download EMP201 eFiling CSV', async () => {
      if (!emp201Id) {
        console.log('Skipping eFiling CSV test - no EMP201 returns available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/sars/emp201/${emp201Id}/efiling-csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Record Type');
    });

    it('/api/sars/emp201/:id/submit (POST) - should submit EMP201 to SARS', async () => {
      if (!emp201Id) {
        console.log('Skipping submit test - no EMP201 returns available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/sars/emp201/${emp201Id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          submitted_by: 'admin',
          sars_reference: 'REF123456',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Security & Permissions', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/sars/tax-periods')
        .expect(401);
    });

    it('should reject requests with invalid auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/sars/tax-periods')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
