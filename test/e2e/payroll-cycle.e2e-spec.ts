/**
 * Payroll Cycle Management E2E Tests
 * Tests payroll calendar, checklists, exceptions, reconciliation, and forecasting
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { cleanupTestData } from '../fixtures/test-data';
import pool from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Payroll Cycle Management (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let managerToken: string;
  let managerId: string;
  let legalEntityId: string;

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

    // Create manager user
    const manager = await createAuthenticatedUser('manager', 'ZAF');
    managerToken = manager.token;
    managerId = manager.user.id;

    // Get legal entity
    const [entities] = await pool.execute(
      'SELECT id FROM legal_entities WHERE country_code = ? LIMIT 1',
      ['ZAF']
    );
    legalEntityId = (entities as any[])[0]?.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupTestUsers();
    await app.close();
  });

  // ==================== PAYROLL CALENDAR ====================

  describe('Payroll Calendar Management', () => {
    let calendarId: string;

    it('should create a monthly payroll calendar', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          legal_entity_id: legalEntityId,
          calendar_name: 'Monthly Payroll 2025',
          frequency: 'monthly',
          start_date: '2025-01-01',
          payment_day_of_month: 25,
          cutoff_days_before_payment: 5,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.frequency).toBe('monthly');
      expect(response.body.is_active).toBe(true);

      calendarId = response.body.id;
    });

    it('should create a bi-weekly payroll calendar', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          legal_entity_id: legalEntityId,
          calendar_name: 'Bi-Weekly Payroll 2025',
          frequency: 'bi_weekly',
          start_date: '2025-01-01',
        })
        .expect(201);

      expect(response.body.frequency).toBe('bi_weekly');
    });

    it('should get all payroll calendars', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get calendar details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/calendar/${calendarId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(calendarId);
      expect(response.body.calendar_name).toBe('Monthly Payroll 2025');
    });

    it('should generate payroll periods', async () => {
      await request(app.getHttpServer())
        .post(`/api/payroll-cycle/calendar/${calendarId}/generate-periods`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          number_of_periods: 12,
        })
        .expect(201);

      // Verify periods were created
      const [periods] = await pool.execute(
        'SELECT COUNT(*) as count FROM payroll_periods WHERE calendar_id = ?',
        [calendarId]
      );
      expect((periods as any[])[0].count).toBe(12);
    });

    it('should get periods for calendar', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/calendar/${calendarId}/periods`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(12);

      const period = response.body[0];
      expect(period).toHaveProperty('period_name');
      expect(period).toHaveProperty('period_start_date');
      expect(period).toHaveProperty('period_end_date');
      expect(period).toHaveProperty('payment_date');
      expect(period).toHaveProperty('cutoff_date');
    });

    it('should get current period', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/calendar/current-period')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ legal_entity_id: legalEntityId })
        .expect(200);

      expect(response.body).toHaveProperty('period_name');
    });

    it('should get upcoming periods', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/calendar/upcoming-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ legal_entity_id: legalEntityId, limit: 3 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(3);
    });

    it('should lock a payroll period', async () => {
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods WHERE calendar_id = ? AND status = ? LIMIT 1',
        [calendarId, 'open']
      );
      const periodId = (periods as any[])[0]?.id;

      if (periodId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/period/${periodId}/lock`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify status
        const [rows] = await pool.execute(
          'SELECT status, locked_date FROM payroll_periods WHERE id = ?',
          [periodId]
        );
        expect((rows as any[])[0].status).toBe('locked');
        expect((rows as any[])[0].locked_date).not.toBeNull();
      }
    });

    it('should unlock a payroll period', async () => {
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods WHERE calendar_id = ? AND status = ? LIMIT 1',
        [calendarId, 'locked']
      );
      const periodId = (periods as any[])[0]?.id;

      if (periodId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/period/${periodId}/unlock`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify status
        const [rows] = await pool.execute(
          'SELECT status FROM payroll_periods WHERE id = ?',
          [periodId]
        );
        expect((rows as any[])[0].status).toBe('open');
      }
    });
  });

  // ==================== PAYROLL CHECKLISTS ====================

  describe('Payroll Checklist Management', () => {
    let periodId: string;
    let checklistId: string;

    beforeAll(async () => {
      // Get a period for testing
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods WHERE status = ? LIMIT 1',
        ['open']
      );
      periodId = (periods as any[])[0]?.id;
    });

    it('should create checklist from template', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/checklist/create-from-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          period_id: periodId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.progress_percentage).toBe(0);

      checklistId = response.body.id;
    });

    it('should get checklist for period', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/checklist/period/${periodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(checklistId);
    });

    it('should get checklist tasks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/checklist/${checklistId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should complete a checklist task', async () => {
      const [tasks] = await pool.execute(
        'SELECT id FROM payroll_checklist_tasks WHERE checklist_id = ? AND status = ? LIMIT 1',
        [checklistId, 'pending']
      );
      const taskId = (tasks as any[])[0]?.id;

      if (taskId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/checklist/task/${taskId}/complete`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            completed_by_id: adminId,
            completion_notes: 'Task completed successfully',
          })
          .expect(200);

        // Verify task status
        const [rows] = await pool.execute(
          'SELECT status, completed_date FROM payroll_checklist_tasks WHERE id = ?',
          [taskId]
        );
        expect((rows as any[])[0].status).toBe('completed');
      }
    });

    it('should get tasks assigned to user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/checklist/my-tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== PAYROLL EXCEPTIONS ====================

  describe('Payroll Exception Detection', () => {
    let periodId: string;
    let payrunId: string;

    beforeAll(async () => {
      // Get a period
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods LIMIT 1'
      );
      periodId = (periods as any[])[0]?.id;

      // Create a test payrun
      payrunId = uuidv4();
      await pool.execute(
        `INSERT INTO payruns (id, payrun_name, period, legal_entity_id, status, payrun_date)
         VALUES (?, ?, ?, ?, ?, CURDATE())`,
        [payrunId, 'Test Payrun', '2025-01', legalEntityId, 'draft']
      );
    });

    it('should detect exceptions for a period', async () => {
      await request(app.getHttpServer())
        .post('/api/payroll-cycle/exceptions/detect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          period_id: periodId,
          payrun_id: payrunId,
        })
        .expect(201);

      // Exceptions may or may not be created depending on data
    });

    it('should get exceptions for a period', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/exceptions/period/${periodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create a manual exception', async () => {
      const [employees] = await pool.execute(
        'SELECT id FROM employees WHERE legal_entity_id = ? LIMIT 1',
        [legalEntityId]
      );
      const employeeId = (employees as any[])[0]?.id;

      if (employeeId) {
        const response = await request(app.getHttpServer())
          .post('/api/payroll-cycle/exceptions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            period_id: periodId,
            payrun_id: payrunId,
            employee_id: employeeId,
            exception_type: 'data_missing',
            exception_category: 'data_missing',
            severity: 'warning',
            exception_description: 'Missing timesheet data',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      }
    });

    it('should resolve an exception', async () => {
      const [exceptions] = await pool.execute(
        'SELECT id FROM payroll_exceptions WHERE period_id = ? AND status = ? LIMIT 1',
        [periodId, 'open']
      );
      const exceptionId = (exceptions as any[])[0]?.id;

      if (exceptionId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/exceptions/${exceptionId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            resolved_by_id: adminId,
            resolution_notes: 'Timesheet data added manually',
          })
          .expect(200);

        // Verify status
        const [rows] = await pool.execute(
          'SELECT status, resolved_date FROM payroll_exceptions WHERE id = ?',
          [exceptionId]
        );
        expect((rows as any[])[0].status).toBe('resolved');
      }
    });

    it('should get exception statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/exceptions/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period_id: periodId })
        .expect(200);

      expect(response.body).toHaveProperty('total_exceptions');
      expect(response.body).toHaveProperty('by_severity');
      expect(response.body).toHaveProperty('by_category');
    });
  });

  // ==================== PAYROLL RECONCILIATION ====================

  describe('Payroll Reconciliation', () => {
    let periodId: string;
    let reconciliationId: string;

    beforeAll(async () => {
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods LIMIT 1'
      );
      periodId = (periods as any[])[0]?.id;
    });

    it('should create period reconciliation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/reconciliation')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          period_id: periodId,
          comparison_type: 'period_over_period',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('in_progress');

      reconciliationId = response.body.id;
    });

    it('should get reconciliation details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/reconciliation/${reconciliationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(reconciliationId);
    });

    it('should get reconciliation items', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/reconciliation/${reconciliationId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should add variance explanation', async () => {
      const [items] = await pool.execute(
        'SELECT id FROM payroll_reconciliation_items WHERE reconciliation_id = ? LIMIT 1',
        [reconciliationId]
      );
      const itemId = (items as any[])[0]?.id;

      if (itemId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/reconciliation/item/${itemId}/explain`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            explanation: 'Variance due to annual salary increases',
          })
          .expect(200);
      }
    });
  });

  // ==================== PAYROLL FORECASTING ====================

  describe('Payroll Forecasting', () => {
    let forecastId: string;

    it('should create historical average forecast', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/forecast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          legal_entity_id: legalEntityId,
          forecast_period: '2025-12',
          forecast_method: 'historical_average',
          assumptions: 'Based on 6-month average',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.forecast_method).toBe('historical_average');

      forecastId = response.body.id;
    });

    it('should create trend-based forecast', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payroll-cycle/forecast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          legal_entity_id: legalEntityId,
          forecast_period: '2025-12',
          forecast_method: 'trend_analysis',
          assumptions: 'Linear regression on 12-month data',
        })
        .expect(201);

      expect(response.body.forecast_method).toBe('trend_analysis');
    });

    it('should get forecast details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/forecast/${forecastId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(forecastId);
    });

    it('should get forecast items', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/payroll-cycle/forecast/${forecastId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should update forecast with actuals', async () => {
      const [items] = await pool.execute(
        'SELECT id FROM payroll_forecast_items WHERE forecast_id = ? LIMIT 1',
        [forecastId]
      );
      const itemId = (items as any[])[0]?.id;

      if (itemId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/forecast/item/${itemId}/update-actual`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            actual_amount: 150000,
          })
          .expect(200);

        // Verify actual was set
        const [rows] = await pool.execute(
          'SELECT actual_amount, variance_amount FROM payroll_forecast_items WHERE id = ?',
          [itemId]
        );
        expect((rows as any[])[0].actual_amount).not.toBeNull();
      }
    });

    it('should get forecasts for entity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payroll-cycle/forecast/entity')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ legal_entity_id: legalEntityId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== SECURITY & PERMISSIONS ====================

  describe('Security & Permissions', () => {
    let employeeToken: string;

    beforeAll(async () => {
      const employee = await createAuthenticatedUser('employee', 'ZAF');
      employeeToken = employee.token;
    });

    it('should deny employee access to create calendar', async () => {
      await request(app.getHttpServer())
        .post('/api/payroll-cycle/calendar')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          legal_entity_id: legalEntityId,
          calendar_name: 'Test Calendar',
          frequency: 'monthly',
          start_date: '2025-01-01',
        })
        .expect(403);
    });

    it('should deny employee access to lock period', async () => {
      const [periods] = await pool.execute(
        'SELECT id FROM payroll_periods LIMIT 1'
      );
      const periodId = (periods as any[])[0]?.id;

      if (periodId) {
        await request(app.getHttpServer())
          .post(`/api/payroll-cycle/period/${periodId}/lock`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .expect(403);
      }
    });

    it('should deny unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/payroll-cycle/calendar')
        .expect(401);
    });
  });
});
