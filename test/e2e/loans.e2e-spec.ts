/**
 * Loan & Advance Management E2E Tests
 * Tests the complete loan application and repayment workflow
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { getTestLoanType, cleanupTestData } from '../fixtures/test-data';

describe('Loan & Advance Management (E2E)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let employeeId: string;
  let managerToken: string;
  let loanTypeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Create test users
    const employee = await createAuthenticatedUser('employee', 'ZAF');
    employeeToken = employee.token;
    employeeId = employee.user.id;

    const manager = await createAuthenticatedUser('manager', 'ZAF');
    managerToken = manager.token;

    // Get a test loan type
    loanTypeId = await getTestLoanType('ZAF');
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupTestUsers();
    await app.close();
  });

  describe('Loan Types', () => {
    it('should get all loan types', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/loans/types')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get available loan types for employee', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loans/types/available/${employeeId}?country=ZAF`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should calculate repayment', async () => {
      const calcData = {
        principal: 10000,
        interest_rate: 5.0,
        tenure_months: 12,
        interest_type: 'flat',
      };

      const response = await request(app.getHttpServer())
        .post('/api/loans/types/calculate-repayment')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(calcData)
        .expect(201);

      expect(response.body).toHaveProperty('monthlyDeduction');
      expect(response.body).toHaveProperty('totalRepayment');
      expect(response.body).toHaveProperty('totalInterest');
      expect(response.body.monthlyDeduction).toBeGreaterThan(0);
    });
  });

  describe('Loan Applications', () => {
    let applicationId: string;

    it('should create a loan application', async () => {
      const applicationData = {
        employee_id: employeeId,
        loan_type_id: loanTypeId,
        requested_amount: 10000,
        tenure_months: 12,
        purpose: 'Emergency medical expenses',
      };

      const response = await request(app.getHttpServer())
        .post('/api/loans/applications')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(applicationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('application_number');
      expect(response.body.status).toBe('draft');
      expect(response.body.requested_amount).toBe(10000);

      applicationId = response.body.id;
    });

    it('should submit loan application', async () => {
      await request(app.getHttpServer())
        .post(`/api/loans/applications/${applicationId}/submit`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(201);

      // Verify status changed
      const response = await request(app.getHttpServer())
        .get(`/api/loans/applications/${applicationId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.status).toBe('pending_approval');
    });

    it('should approve loan application', async () => {
      await request(app.getHttpServer())
        .post(`/api/loans/applications/${applicationId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comments: 'Approved - valid reason' })
        .expect(201);

      // Verify approval
      const response = await request(app.getHttpServer())
        .get(`/api/loans/applications/${applicationId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.status).toBe('approved');
    });

    it('should get employee loan applications', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loans/applications?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get application statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loans/stats/applications?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_applications');
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('approved');
    });
  });

  describe('Active Loans & Repayments', () => {
    let loanId: string;

    it('should disburse approved loan', async () => {
      // First, get an approved application
      const appsResponse = await request(app.getHttpServer())
        .get(`/api/loans/applications?employee_id=${employeeId}&status=approved`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const approvedApp = appsResponse.body[0];

      const disbursementData = {
        application_id: approvedApp.id,
        disbursement_date: new Date().toISOString().split('T')[0],
        first_deduction_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const response = await request(app.getHttpServer())
        .post('/api/loans/active/disburse')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(disbursementData)
        .expect(201);

      expect(response.body).toHaveProperty('loan_number');
      expect(response.body.status).toBe('active');

      loanId = response.body.id;
    });

    it('should get active loans', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loans/active?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get loan schedule', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loans/active/${loanId}/schedule`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(12); // 12-month tenure
      expect(response.body[0]).toHaveProperty('installment_number');
      expect(response.body[0]).toHaveProperty('due_date');
      expect(response.body[0]).toHaveProperty('total_amount');
    });

    it('should record a repayment', async () => {
      const scheduleResponse = await request(app.getHttpServer())
        .get(`/api/loans/active/${loanId}/schedule`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const firstInstallment = scheduleResponse.body[0];

      const repaymentData = {
        amount: firstInstallment.total_amount,
        payment_date: new Date().toISOString().split('T')[0],
      };

      await request(app.getHttpServer())
        .post(`/api/loans/active/${loanId}/repay`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(repaymentData)
        .expect(201);

      // Verify loan balance updated
      const loanResponse = await request(app.getHttpServer())
        .get(`/api/loans/active/${loanId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(parseFloat(loanResponse.body.total_paid)).toBeGreaterThan(0);
      expect(parseFloat(loanResponse.body.outstanding_balance)).toBeLessThan(
        parseFloat(loanResponse.body.total_repayment)
      );
    });
  });
});
