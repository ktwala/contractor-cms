/**
 * Performance Management E2E Tests
 * Tests the complete performance management workflow
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { createTestPerformanceCycle, createTestGoal, cleanupTestData } from '../fixtures/test-data';

describe('Performance Management (E2E)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let employeeId: string;
  let managerToken: string;
  let managerId: string;
  let cycleId: string;

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
    managerId = manager.user.id;

    // Create test cycle
    cycleId = await createTestPerformanceCycle('ZAF');
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupTestUsers();
    await app.close();
  });

  describe('Performance Cycles', () => {
    it('should get all performance cycles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/performance/cycles')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should create a new performance cycle (manager only)', async () => {
      const cycleData = {
        name: 'Q1 2024 Performance Review',
        description: 'First quarter performance review cycle',
        cycle_type: 'quarterly',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        review_start_date: '2024-03-15',
        review_end_date: '2024-03-31',
        country: 'ZAF',
        self_assessment_enabled: true,
        manager_review_enabled: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/performance/cycles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(cycleData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(cycleData.name);
      expect(response.body.status).toBe('draft');
    });

    it('should get cycle statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/performance/cycles/${cycleId}/stats`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_reviews');
      expect(response.body).toHaveProperty('total_goals');
    });
  });

  describe('Performance Goals', () => {
    let goalId: string;

    it('should create a performance goal', async () => {
      const goalData = {
        employee_id: employeeId,
        cycle_id: cycleId,
        title: 'Increase Sales by 20%',
        description: 'Achieve 20% increase in quarterly sales revenue',
        goal_type: 'individual',
        category: 'performance',
        metric: 'Sales Revenue',
        target_value: '120000',
        unit: 'ZAR',
        start_date: '2024-01-01',
        due_date: '2024-12-31',
        weight: 50,
        manager_id: managerId,
      };

      const response = await request(app.getHttpServer())
        .post('/api/performance/goals')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(goalData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(goalData.title);
      expect(response.body.status).toBe('active');

      goalId = response.body.id;
    });

    it('should get employee goals', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/performance/goals?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('employee_name');
    });

    it('should update goal progress', async () => {
      const progressData = {
        current_value: '60000',
        completion_percentage: 50,
        employee_comments: 'Making good progress, halfway to target',
      };

      await request(app.getHttpServer())
        .put(`/api/performance/goals/${goalId}/progress`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(progressData)
        .expect(200);

      // Verify update
      const response = await request(app.getHttpServer())
        .get(`/api/performance/goals?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const updatedGoal = response.body.find((g: any) => g.id === goalId);
      expect(updatedGoal.current_value).toBe('60000');
      expect(updatedGoal.completion_percentage).toBe(50);
    });
  });

  describe('Performance Reviews', () => {
    let reviewId: string;

    it('should create a performance review', async () => {
      const reviewData = {
        employee_id: employeeId,
        cycle_id: cycleId,
        manager_id: managerId,
        review_type: 'manager_review',
        review_period_start: '2024-01-01',
        review_period_end: '2024-12-31',
      };

      const response = await request(app.getHttpServer())
        .post('/api/performance/reviews')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('review_number');
      expect(response.body.status).toBe('not_started');

      reviewId = response.body.id;
    });

    it('should submit self-assessment', async () => {
      const selfAssessment = {
        overall_rating: 4,
        employee_comments: 'I believe I have met all my goals this year and exceeded expectations in several areas.',
      };

      await request(app.getHttpServer())
        .post(`/api/performance/reviews/${reviewId}/self-assessment`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(selfAssessment)
        .expect(201);
    });

    it('should submit manager review', async () => {
      const managerReview = {
        overall_rating: 4,
        goals_rating: 4,
        competencies_rating: 4,
        manager_comments: 'Strong performance throughout the year. Exceeded sales targets.',
        performance_category: 'high_performer',
        recommended_for_promotion: false,
        recommended_salary_increase: 5.0,
      };

      await request(app.getHttpServer())
        .post(`/api/performance/reviews/${reviewId}/manager-review`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(managerReview)
        .expect(201);

      // Verify review was completed
      const response = await request(app.getHttpServer())
        .get(`/api/performance/reviews?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const completedReview = response.body.find((r: any) => r.id === reviewId);
      expect(completedReview.status).toBe('completed');
      expect(completedReview.overall_rating).toBe(4);
    });

    it('should get employee reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/performance/reviews?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('360-Degree Feedback', () => {
    let feedbackId: string;
    let reviewId: string;

    beforeAll(async () => {
      // Create a review first
      const reviewData = {
        employee_id: employeeId,
        cycle_id: cycleId,
        manager_id: managerId,
        review_type: '360',
        review_period_start: '2024-01-01',
        review_period_end: '2024-12-31',
      };

      const response = await request(app.getHttpServer())
        .post('/api/performance/reviews')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reviewData)
        .expect(201);

      reviewId = response.body.id;
    });

    it('should request peer feedback', async () => {
      const feedbackRequest = {
        review_id: reviewId,
        employee_id: employeeId,
        feedback_provider_id: managerId,
        relationship: 'Team Member',
      };

      const response = await request(app.getHttpServer())
        .post('/api/performance/feedback/request')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(feedbackRequest)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      feedbackId = response.body.id;
    });

    it('should get pending feedback requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/performance/feedback/pending')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const pendingFeedback = response.body.find((f: any) => f.id === feedbackId);
      expect(pendingFeedback).toBeDefined();
    });

    it('should submit peer feedback', async () => {
      const feedback = {
        overall_rating: 4,
        strengths: 'Excellent communication and teamwork skills',
        areas_for_improvement: 'Could be more proactive in taking on leadership roles',
        collaboration_feedback: 'Always willing to help team members',
        communication_feedback: 'Clear and concise in all interactions',
      };

      await request(app.getHttpServer())
        .post(`/api/performance/feedback/${feedbackId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(feedback)
        .expect(201);
    });
  });

  describe('Statistics', () => {
    it('should get employee performance statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/performance/stats/employee/${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_reviews');
      expect(response.body).toHaveProperty('total_goals');
      expect(response.body).toHaveProperty('avg_rating');
    });
  });
});
