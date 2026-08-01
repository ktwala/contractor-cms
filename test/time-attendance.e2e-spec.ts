import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Time & Attendance (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let employeeId: string;
  let shiftId: string;
  let attendanceRecordId: string;

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

    // Get an employee ID for testing
    const employeeResponse = await request(app.getHttpServer())
      .get('/api/employees')
      .set('Authorization', `Bearer ${authToken}`);

    if (employeeResponse.body.length > 0) {
      employeeId = employeeResponse.body[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Shifts Management', () => {
    it('/api/time-attendance/shifts (GET) - should return all shifts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/time-attendance/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify shift structure
      const shift = response.body[0];
      expect(shift).toHaveProperty('id');
      expect(shift).toHaveProperty('shift_name');
      expect(shift).toHaveProperty('start_time');
      expect(shift).toHaveProperty('end_time');
      expect(shift).toHaveProperty('overtime_multiplier');
      expect(shift).toHaveProperty('is_active');

      shiftId = shift.id;
    });

    it('/api/time-attendance/shifts (GET) - should filter by active status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/time-attendance/shifts?is_active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((shift: any) => {
        expect(shift.is_active).toBe(true);
      });
    });

    it('/api/time-attendance/shifts (POST) - should create new shift', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/time-attendance/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shift_name: 'E2E Test Shift',
          shift_code: 'E2E-001',
          start_time: '09:00:00',
          end_time: '18:00:00',
          break_duration_minutes: 60,
          break_paid: false,
          shift_type: 'regular',
          overtime_multiplier: 1.5,
          late_grace_period: 15,
          country: 'ZA',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.shift_name).toBe('E2E Test Shift');
      expect(response.body.shift_code).toBe('E2E-001');
    });

    it('/api/time-attendance/shifts/assign (POST) - should assign shift to employee', async () => {
      if (!employeeId || !shiftId) {
        console.log('Skipping shift assignment - missing employee or shift');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/api/time-attendance/shifts/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          shift_id: shiftId,
          effective_from: new Date().toISOString().split('T')[0],
          work_days: [1, 2, 3, 4, 5], // Monday to Friday
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('assignment_id');
    });
  });

  describe('Clock In/Out', () => {
    it('/api/time-attendance/status (GET) - should return attendance status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/time-attendance/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('is_clocked_in');
      expect(response.body).toHaveProperty('attendance_date');
    });

    it('/api/time-attendance/clock-in (POST) - should clock in employee', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/time-attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: '-25.7479,28.2293', // Pretoria coordinates
          device_type: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('record_id');
      expect(response.body).toHaveProperty('clock_in_time');

      attendanceRecordId = response.body.record_id;
    });

    it('/api/time-attendance/clock-in (POST) - should not allow duplicate clock in', async () => {
      await request(app.getHttpServer())
        .post('/api/time-attendance/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: '-25.7479,28.2293',
          device_type: 'web',
        })
        .expect(400);
    });

    it('/api/time-attendance/status (GET) - should show clocked in status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/time-attendance/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.is_clocked_in).toBe(true);
      expect(response.body.clock_in_time).toBeDefined();
    });

    it('/api/time-attendance/clock-out (POST) - should clock out employee', async () => {
      // Wait a bit to ensure some time has passed
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(app.getHttpServer())
        .post('/api/time-attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: '-25.7479,28.2293',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('clock_out_time');
      expect(response.body).toHaveProperty('total_hours');
      expect(response.body.total_hours).toBeGreaterThan(0);
    });

    it('/api/time-attendance/clock-out (POST) - should not allow clock out without clock in', async () => {
      await request(app.getHttpServer())
        .post('/api/time-attendance/clock-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: '-25.7479,28.2293',
        })
        .expect(400);
    });
  });

  describe('Attendance Records', () => {
    it('/api/time-attendance/attendance/:employee_id (GET) - should return attendance records', async () => {
      if (!employeeId) {
        console.log('Skipping attendance records test - no employee ID');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const response = await request(app.getHttpServer())
        .get(`/api/time-attendance/attendance/${employeeId}?date_from=${today}&date_to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      if (response.body.length > 0) {
        const record = response.body[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('attendance_date');
        expect(record).toHaveProperty('clock_in_time');
        expect(record).toHaveProperty('total_hours');
        expect(record).toHaveProperty('status');
      }
    });

    it('/api/time-attendance/attendance/:employee_id (GET) - should filter by date range', async () => {
      if (!employeeId) {
        console.log('Skipping date range test - no employee ID');
        return;
      }

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      const dateTo = new Date();

      const response = await request(app.getHttpServer())
        .get(`/api/time-attendance/attendance/${employeeId}?date_from=${dateFrom.toISOString().split('T')[0]}&date_to=${dateTo.toISOString().split('T')[0]}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('Attendance Summary', () => {
    it('/api/time-attendance/summary/:employee_id/:month (GET) - should return monthly summary', async () => {
      if (!employeeId) {
        console.log('Skipping summary test - no employee ID');
        return;
      }

      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

      const response = await request(app.getHttpServer())
        .get(`/api/time-attendance/summary/${employeeId}/${currentMonth}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('employee_id');
      expect(response.body).toHaveProperty('total_days');
      expect(response.body).toHaveProperty('days_present');
      expect(response.body).toHaveProperty('days_absent');
    });
  });

  describe('Overtime Management', () => {
    it('/api/time-attendance/overtime/request (POST) - should request overtime', async () => {
      if (!employeeId) {
        console.log('Skipping overtime request - no employee ID');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/api/time-attendance/overtime/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          overtime_date: new Date().toISOString().split('T')[0],
          start_time: '18:00:00',
          end_time: '20:00:00',
          estimated_hours: 2,
          reason: 'E2E Test Overtime',
          overtime_multiplier: 1.5,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('request_id');
    });
  });

  describe('Security & Permissions', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/time-attendance/shifts')
        .expect(401);
    });

    it('should reject clock in without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/time-attendance/clock-in')
        .send({
          location: '-25.7479,28.2293',
          device_type: 'web',
        })
        .expect(401);
    });
  });

  describe('Edge Cases & Validations', () => {
    it('should handle invalid employee ID gracefully', async () => {
      await request(app.getHttpServer())
        .get('/api/time-attendance/attendance/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Should return empty array, not error
    });

    it('should handle invalid date format gracefully', async () => {
      if (!employeeId) return;

      const response = await request(app.getHttpServer())
        .get(`/api/time-attendance/attendance/${employeeId}?date_from=invalid-date`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either return 400 or handle gracefully with empty results
      expect([200, 400]).toContain(response.status);
    });
  });
});
