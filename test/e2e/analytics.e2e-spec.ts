/**
 * Analytics & Reports E2E Tests
 * Tests the analytics dashboard and reporting functionality
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { cleanupTestData } from '../fixtures/test-data';

describe('Analytics & Reports (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Create admin user
    const admin = await createAuthenticatedUser('admin', 'ZAF');
    adminToken = admin.token;
    adminId = admin.user.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupTestUsers();
    await app.close();
  });

  // ==================== DASHBOARD METRICS ====================

  describe('GET /api/analytics/dashboard', () => {
    it('should get dashboard overview metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF' })
        .expect(200);

      expect(response.body).toHaveProperty('employees');
      expect(response.body).toHaveProperty('payroll');
      expect(response.body).toHaveProperty('leave');
      expect(response.body).toHaveProperty('expenses');
      expect(response.body).toHaveProperty('loans');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('generated_at');

      // Employee metrics
      expect(response.body.employees).toHaveProperty('total_employees');
      expect(response.body.employees).toHaveProperty('active_employees');
      expect(response.body.employees).toHaveProperty('inactive_employees');

      // Payroll metrics
      expect(response.body.payroll).toHaveProperty('total_gross_pay');
      expect(response.body.payroll).toHaveProperty('total_net_pay');
    });

    it('should filter dashboard metrics by country', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'LSO' })
        .expect(200);

      expect(response.body).toHaveProperty('employees');
    });
  });

  // ==================== PAYROLL TRENDS ====================

  describe('GET /api/analytics/payroll/trends', () => {
    it('should get monthly payroll trends', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/payroll/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF', period: 'monthly', limit: 12 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const trend = response.body[0];
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('payrun_count');
        expect(trend).toHaveProperty('employee_count');
        expect(trend).toHaveProperty('total_gross');
        expect(trend).toHaveProperty('total_net');
        expect(trend).toHaveProperty('avg_gross_pay');
      }
    });

    it('should get quarterly payroll trends', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/payroll/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'quarterly', limit: 4 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get yearly payroll trends', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/payroll/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'yearly', limit: 3 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== DEPARTMENT ANALYSIS ====================

  describe('GET /api/analytics/departments', () => {
    it('should get department cost analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const dept = response.body[0];
        expect(dept).toHaveProperty('department');
        expect(dept).toHaveProperty('employee_count');
        expect(dept).toHaveProperty('avg_salary');
        expect(dept).toHaveProperty('total_cost');
        expect(dept).toHaveProperty('total_employer_costs');
      }
    });
  });

  // ==================== TAX SUMMARY ====================

  describe('GET /api/analytics/tax/summary', () => {
    it('should get tax summary', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';

      const response = await request(app.getHttpServer())
        .get('/api/analytics/tax/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF', date_from: dateFrom, date_to: dateTo })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const taxEntry = response.body[0];
        expect(taxEntry).toHaveProperty('tax_type');
        expect(taxEntry).toHaveProperty('tax_name');
        expect(taxEntry).toHaveProperty('payrun_count');
        expect(taxEntry).toHaveProperty('total_employee_tax');
        expect(taxEntry).toHaveProperty('total_employer_tax');
        expect(taxEntry).toHaveProperty('total_tax');
      }
    });

    it('should filter tax summary by date range', async () => {
      const dateFrom = '2024-06-01';
      const dateTo = '2024-06-30';

      const response = await request(app.getHttpServer())
        .get('/api/analytics/tax/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ date_from: dateFrom, date_to: dateTo })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== TURNOVER ANALYSIS ====================

  describe('GET /api/analytics/turnover', () => {
    it('should get employee turnover analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/turnover')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF', period_months: 12 })
        .expect(200);

      expect(response.body).toHaveProperty('terminated_count');
      expect(response.body).toHaveProperty('hired_count');
      expect(response.body).toHaveProperty('current_active');
      expect(response.body).toHaveProperty('avg_tenure_months');
      expect(response.body).toHaveProperty('turnover_rate');
      expect(response.body).toHaveProperty('period_months');
      expect(response.body.period_months).toBe(12);
    });

    it('should calculate turnover for different periods', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/turnover')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period_months: 6 })
        .expect(200);

      expect(response.body.period_months).toBe(6);
    });
  });

  // ==================== EXPENSE ANALYTICS ====================

  describe('GET /api/analytics/expenses', () => {
    it('should get expense analytics by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const category = response.body[0];
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('claim_count');
        expect(category).toHaveProperty('item_count');
        expect(category).toHaveProperty('total_amount');
        expect(category).toHaveProperty('avg_amount');
        expect(category).toHaveProperty('pending_amount');
      }
    });

    it('should filter expenses by date range', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';

      const response = await request(app.getHttpServer())
        .get('/api/analytics/expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ date_from: dateFrom, date_to: dateTo })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== LOAN PORTFOLIO ====================

  describe('GET /api/analytics/loans/portfolio', () => {
    it('should get loan portfolio summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/loans/portfolio')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const loanType = response.body[0];
        expect(loanType).toHaveProperty('loan_type');
        expect(loanType).toHaveProperty('active_loans');
        expect(loanType).toHaveProperty('total_principal');
        expect(loanType).toHaveProperty('total_outstanding');
        expect(loanType).toHaveProperty('total_paid');
        expect(loanType).toHaveProperty('avg_interest_rate');
      }
    });
  });

  // ==================== PERFORMANCE STATS ====================

  describe('GET /api/analytics/performance', () => {
    it('should get performance review statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('category_distribution');

      const summary = response.body.summary;
      expect(summary).toHaveProperty('total_reviews');
      expect(summary).toHaveProperty('completed_reviews');
      expect(summary).toHaveProperty('in_progress_reviews');
      expect(summary).toHaveProperty('avg_overall_rating');

      expect(Array.isArray(response.body.category_distribution)).toBe(true);
    });
  });

  // ==================== SAVED REPORTS ====================

  describe('POST /api/analytics/reports/saved', () => {
    it('should create a saved report configuration', async () => {
      const reportData = {
        report_name: 'Monthly Tax Report',
        report_type: 'tax_summary',
        description: 'Monthly tax summary for compliance',
        filters: { country: 'ZAF', date_from: '2024-01-01', date_to: '2024-01-31' },
        columns: ['tax_type', 'tax_name', 'total_tax'],
        output_format: 'csv',
        visibility: 'private',
        created_by: adminId,
        country: 'ZAF',
      };

      const response = await request(app.getHttpServer())
        .post('/api/analytics/reports/saved')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reportData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.report_name).toBe('Monthly Tax Report');
      expect(response.body.report_type).toBe('tax_summary');
      expect(response.body.output_format).toBe('csv');
    });

    it('should create a scheduled report', async () => {
      const reportData = {
        report_name: 'Weekly Payroll Summary',
        report_type: 'payroll_summary',
        description: 'Weekly automated payroll summary',
        filters: { country: 'ZAF' },
        is_scheduled: true,
        schedule_frequency: 'weekly',
        output_format: 'xlsx',
        email_recipients: ['admin@example.com'],
        visibility: 'team',
        created_by: adminId,
        country: 'ZAF',
      };

      const response = await request(app.getHttpServer())
        .post('/api/analytics/reports/saved')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reportData)
        .expect(201);

      expect(response.body.is_scheduled).toBe(true);
      expect(response.body.schedule_frequency).toBe('weekly');
    });
  });

  describe('GET /api/analytics/reports/saved', () => {
    it('should get saved reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/reports/saved')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const report = response.body[0];
        expect(report).toHaveProperty('id');
        expect(report).toHaveProperty('report_name');
        expect(report).toHaveProperty('report_type');
        expect(report).toHaveProperty('created_at');
      }
    });

    it('should filter saved reports by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/reports/saved')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ report_type: 'tax_summary' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((report: any) => {
        expect(report.report_type).toBe('tax_summary');
      });
    });

    it('should filter saved reports by creator', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/reports/saved')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ created_by: adminId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== KPIs ====================

  describe('GET /api/analytics/kpis', () => {
    it('should get all active KPIs', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const kpi = response.body[0];
      expect(kpi).toHaveProperty('id');
      expect(kpi).toHaveProperty('kpi_name');
      expect(kpi).toHaveProperty('kpi_type');
      expect(kpi).toHaveProperty('current_value');
      expect(kpi).toHaveProperty('unit');
    });

    it('should filter KPIs by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ kpi_type: 'payroll' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((kpi: any) => {
        expect(kpi.kpi_type).toBe('payroll');
      });
    });

    it('should filter KPIs by country', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ country: 'ZAF' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/analytics/kpis/:id/update', () => {
    it('should update KPI value', async () => {
      // First get a KPI
      const kpisResponse = await request(app.getHttpServer())
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (kpisResponse.body.length > 0) {
        const kpiId = kpisResponse.body[0].id;
        const newValue = 12500.50;

        const response = await request(app.getHttpServer())
          .post(`/api/analytics/kpis/${kpiId}/update`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ value: newValue })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });

  // ==================== AUTHORIZATION ====================

  describe('Authorization', () => {
    it('should reject unauthorized requests', async () => {
      await request(app.getHttpServer())
        .get('/api/analytics/dashboard')
        .expect(401);
    });

    it('should reject requests without proper permissions', async () => {
      const employee = await createAuthenticatedUser('employee', 'ZAF');

      await request(app.getHttpServer())
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${employee.token}`)
        .expect(403);
    });
  });
});
