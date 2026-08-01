/**
 * Recruitment & Onboarding E2E Tests
 * Tests the complete hiring lifecycle from job posting through employee onboarding
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { cleanupTestData } from '../fixtures/test-data';
import pool from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Recruitment & Onboarding (E2E)', () => {
  let app: INestApplication;
  let hrToken: string;
  let hrId: string;
  let managerToken: string;
  let managerId: string;
  let legalEntityId: string;
  let departmentId: string;
  let templateId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Create HR user
    const hr = await createAuthenticatedUser('admin', 'ZAF');
    hrToken = hr.token;
    hrId = hr.user.id;

    // Create manager user
    const manager = await createAuthenticatedUser('manager', 'ZAF');
    managerToken = manager.token;
    managerId = manager.user.id;

    // Get legal entity and department
    const [entities] = await pool.execute(
      'SELECT id FROM legal_entities WHERE country_code = ? LIMIT 1',
      ['ZAF']
    );
    legalEntityId = (entities as any[])[0]?.id;

    const [departments] = await pool.execute(
      'SELECT id FROM departments LIMIT 1'
    );
    departmentId = (departments as any[])[0]?.id;

    // Get onboarding template
    const [templates] = await pool.execute(
      'SELECT id FROM onboarding_checklist_templates WHERE is_active = TRUE LIMIT 1'
    );
    templateId = (templates as any[])[0]?.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupTestUsers();
    await app.close();
  });

  // ==================== JOB REQUISITIONS ====================

  describe('Job Requisition Lifecycle', () => {
    let requisitionId: string;

    it('should create a job requisition', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          job_title: 'Senior Software Engineer',
          job_level: 'senior',
          employment_type: 'permanent',
          department_id: departmentId,
          legal_entity_id: legalEntityId,
          hiring_manager_id: managerId,
          salary_range_min: 80000,
          salary_range_max: 120000,
          number_of_openings: 2,
          job_description: 'We are looking for an experienced software engineer...',
          required_qualifications: 'BSc Computer Science or equivalent',
          required_skills: 'TypeScript, NestJS, React, MySQL',
          required_experience_years: 5,
          posting_channels: 'linkedin,indeed,company_website',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.job_title).toBe('Senior Software Engineer');
      expect(response.body.status).toBe('draft');

      requisitionId = response.body.id;
    });

    it('should get all job requisitions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should approve a job requisition', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Verify status changed
      const [rows] = await pool.execute(
        'SELECT status FROM job_requisitions WHERE id = ?',
        [requisitionId]
      );
      expect((rows as any[])[0].status).toBe('approved');
    });

    it('should post a job requisition', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${requisitionId}/post`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Verify status changed
      const [rows] = await pool.execute(
        'SELECT status, posted_date FROM job_requisitions WHERE id = ?',
        [requisitionId]
      );
      expect((rows as any[])[0].status).toBe('posted');
      expect((rows as any[])[0].posted_date).not.toBeNull();
    });

    it('should get open requisitions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recruitment/requisitions/open')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const postedReq = response.body.find((r: any) => r.id === requisitionId);
      expect(postedReq).toBeDefined();
    });
  });

  // ==================== CANDIDATES & APPLICATIONS ====================

  describe('Candidate & Application Tracking', () => {
    let requisitionId: string;
    let candidateId: string;
    let applicationId: string;

    beforeAll(async () => {
      // Create and post a requisition
      const reqResponse = await request(app.getHttpServer())
        .post('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          job_title: 'Backend Developer',
          job_level: 'mid',
          employment_type: 'permanent',
          department_id: departmentId,
          legal_entity_id: legalEntityId,
          salary_range_min: 60000,
          salary_range_max: 90000,
        });
      requisitionId = reqResponse.body.id;

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${requisitionId}/post`)
        .set('Authorization', `Bearer ${hrToken}`);
    });

    it('should create a new candidate', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone: '+27123456789',
          source: 'linkedin',
          linkedin_profile: 'https://linkedin.com/in/johndoe',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('john.doe@example.com');

      candidateId = response.body.id;
    });

    it('should prevent duplicate candidate creation (by email)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'John',
          last_name: 'Smith',
          email: 'john.doe@example.com',
          phone: '+27987654321',
        })
        .expect(201);

      // Should return the same candidate ID
      expect(response.body.id).toBe(candidateId);
    });

    it('should get candidate profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/candidates/${candidateId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.id).toBe(candidateId);
      expect(response.body.first_name).toBe('John');
    });

    it('should update candidate information', async () => {
      await request(app.getHttpServer())
        .put(`/api/recruitment/candidates/${candidateId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          phone: '+27111222333',
          current_company: 'Tech Corp',
          current_title: 'Software Engineer',
        })
        .expect(200);

      // Verify update
      const [rows] = await pool.execute(
        'SELECT phone, current_company FROM candidates WHERE id = ?',
        [candidateId]
      );
      expect((rows as any[])[0].phone).toBe('+27111222333');
    });

    it('should submit a job application', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/applications')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          requisition_id: requisitionId,
          candidate_id: candidateId,
          cover_letter: 'I am excited to apply for this position...',
          resume_path: '/resumes/johndoe.pdf',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.application_status).toBe('applied');
      expect(response.body.application_stage).toBe('applied');

      applicationId = response.body.id;
    });

    it('should get applications for a requisition', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/applications/${requisitionId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const app = response.body.find((a: any) => a.id === applicationId);
      expect(app).toBeDefined();
    });

    it('should move application to next stage', async () => {
      await request(app.getHttpServer())
        .put(`/api/recruitment/applications/${applicationId}/stage`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          new_stage: 'screening',
        })
        .expect(200);

      // Verify stage changed
      const [rows] = await pool.execute(
        'SELECT application_stage FROM job_applications WHERE id = ?',
        [applicationId]
      );
      expect((rows as any[])[0].application_stage).toBe('screening');
    });

    it('should reject an application', async () => {
      // Create another application to reject
      const candidate2Response = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
        });

      const app2Response = await request(app.getHttpServer())
        .post('/api/recruitment/applications')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          requisition_id: requisitionId,
          candidate_id: candidate2Response.body.id,
        });

      await request(app.getHttpServer())
        .post(`/api/recruitment/applications/${app2Response.body.id}/reject`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          rejection_reason: 'Does not meet experience requirements',
        })
        .expect(200);

      // Verify rejection
      const [rows] = await pool.execute(
        'SELECT application_status, application_stage FROM job_applications WHERE id = ?',
        [app2Response.body.id]
      );
      expect((rows as any[])[0].application_status).toBe('rejected');
      expect((rows as any[])[0].application_stage).toBe('rejected');
    });
  });

  // ==================== INTERVIEWS ====================

  describe('Interview Management', () => {
    let applicationId: string;
    let interviewId: string;

    beforeAll(async () => {
      // Create requisition, candidate, and application
      const reqResponse = await request(app.getHttpServer())
        .post('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          job_title: 'Frontend Developer',
          job_level: 'mid',
          employment_type: 'permanent',
          department_id: departmentId,
          legal_entity_id: legalEntityId,
        });

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${reqResponse.body.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${reqResponse.body.id}/post`)
        .set('Authorization', `Bearer ${hrToken}`);

      const candidateResponse = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'Alice',
          last_name: 'Johnson',
          email: 'alice.johnson@example.com',
        });

      const appResponse = await request(app.getHttpServer())
        .post('/api/recruitment/applications')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          requisition_id: reqResponse.body.id,
          candidate_id: candidateResponse.body.id,
        });

      applicationId = appResponse.body.id;
    });

    it('should schedule an interview', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/interviews')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          application_id: applicationId,
          interview_type: 'phone_screen',
          scheduled_date: '2025-01-15',
          scheduled_time: '14:00',
          interviewer_ids: [managerId],
          location: 'Phone Call',
          duration_minutes: 30,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.interview_type).toBe('phone_screen');
      expect(response.body.status).toBe('scheduled');
      expect(response.body.interview_round).toBe(1);

      interviewId = response.body.id;
    });

    it('should auto-increment interview round for second interview', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/interviews')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          application_id: applicationId,
          interview_type: 'technical',
          scheduled_date: '2025-01-20',
          scheduled_time: '10:00',
          interviewer_ids: [managerId],
        })
        .expect(201);

      expect(response.body.interview_round).toBe(2);
    });

    it('should get interviews for an application', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/interviews/${applicationId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get my upcoming interviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recruitment/interviews/my-interviews')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get interview details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.id).toBe(interviewId);
    });

    it('should submit interview feedback', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/interviews/${interviewId}/feedback`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          overall_rating: 4,
          skills_rating: 4,
          culture_fit_rating: 5,
          communication_rating: 4,
          technical_rating: 4,
          recommendation: 'yes',
          feedback_notes: 'Good candidate with solid experience. Recommending to move forward.',
          strengths: 'Strong technical skills, good communication',
          weaknesses: 'Limited experience with our specific tech stack',
        })
        .expect(200);

      // Verify feedback was created
      const [rows] = await pool.execute(
        'SELECT * FROM interview_feedback WHERE interview_id = ?',
        [interviewId]
      );
      expect((rows as any[]).length).toBe(1);
      expect((rows as any[])[0].overall_rating).toBe(4);
    });

    it('should mark interview as complete', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/interviews/${interviewId}/complete`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Verify status
      const [rows] = await pool.execute(
        'SELECT status FROM interviews WHERE id = ?',
        [interviewId]
      );
      expect((rows as any[])[0].status).toBe('completed');
    });
  });

  // ==================== OFFERS ====================

  describe('Offer Management', () => {
    let applicationId: string;
    let offerId: string;
    let newEmployeeId: string;

    beforeAll(async () => {
      // Create complete workflow: requisition -> candidate -> application -> interview
      const reqResponse = await request(app.getHttpServer())
        .post('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          job_title: 'DevOps Engineer',
          job_level: 'senior',
          employment_type: 'permanent',
          department_id: departmentId,
          legal_entity_id: legalEntityId,
          salary_range_min: 90000,
          salary_range_max: 130000,
        });

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${reqResponse.body.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      await request(app.getHttpServer())
        .post(`/api/recruitment/requisitions/${reqResponse.body.id}/post`)
        .set('Authorization', `Bearer ${hrToken}`);

      const candidateResponse = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'Bob',
          last_name: 'Williams',
          email: 'bob.williams@example.com',
        });

      const appResponse = await request(app.getHttpServer())
        .post('/api/recruitment/applications')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          requisition_id: reqResponse.body.id,
          candidate_id: candidateResponse.body.id,
        });

      applicationId = appResponse.body.id;

      // Create employee record for later use
      newEmployeeId = uuidv4();
      await pool.execute(
        `INSERT INTO employees (id, employee_number, first_name, last_name, email, legal_entity_id, department_id, position, hire_date, employment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'active')`,
        [newEmployeeId, 'EMP' + Math.floor(Math.random() * 10000), 'Bob', 'Williams', 'bob.williams@example.com', legalEntityId, departmentId, 'DevOps Engineer']
      );
    });

    it('should create a job offer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/offers')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          application_id: applicationId,
          offer_type: 'full_time',
          job_title: 'DevOps Engineer',
          department_id: departmentId,
          reporting_to_id: managerId,
          salary_amount: 110000,
          salary_currency: 'ZAR',
          salary_frequency: 'monthly',
          signing_bonus: 10000,
          relocation_assistance: 5000,
          benefits_summary: 'Medical aid, retirement fund, 20 days annual leave',
          equity_options: '1000 stock options vesting over 4 years',
          probation_period_months: 3,
          start_date: '2025-02-01',
          offer_expiry_date: '2025-01-20',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('draft');
      expect(response.body.salary_amount).toBe('110000.00');

      offerId = response.body.id;
    });

    it('should approve an offer', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offerId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Verify status
      const [rows] = await pool.execute(
        'SELECT status FROM job_offers WHERE id = ?',
        [offerId]
      );
      expect((rows as any[])[0].status).toBe('approved');
    });

    it('should send an offer', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offerId}/send`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Verify status
      const [rows] = await pool.execute(
        'SELECT status, sent_date FROM job_offers WHERE id = ?',
        [offerId]
      );
      expect((rows as any[])[0].status).toBe('sent');
      expect((rows as any[])[0].sent_date).not.toBeNull();
    });

    it('should get offer details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/offers/${offerId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.id).toBe(offerId);
      expect(response.body.job_title).toBe('DevOps Engineer');
    });

    it('should get offers for an application', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/offers/application/${applicationId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].id).toBe(offerId);
    });

    it('should get pending offers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recruitment/offers/pending')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept an offer', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Verify offer status
      const [offerRows] = await pool.execute(
        'SELECT status, response_date FROM job_offers WHERE id = ?',
        [offerId]
      );
      expect((offerRows as any[])[0].status).toBe('accepted');
      expect((offerRows as any[])[0].response_date).not.toBeNull();

      // Verify application status updated
      const [appRows] = await pool.execute(
        'SELECT application_status, application_stage, hired_date FROM job_applications WHERE id = ?',
        [applicationId]
      );
      expect((appRows as any[])[0].application_status).toBe('hired');
      expect((appRows as any[])[0].application_stage).toBe('hired');
      expect((appRows as any[])[0].hired_date).not.toBeNull();
    });

    it('should decline an offer', async () => {
      // Create another offer to decline
      const candidate2Response = await request(app.getHttpServer())
        .post('/api/recruitment/candidates')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          first_name: 'Carol',
          last_name: 'Davis',
          email: 'carol.davis@example.com',
        });

      const [requisitions] = await pool.execute(
        'SELECT id FROM job_requisitions WHERE status = ? LIMIT 1',
        ['posted']
      );
      const requisitionId = (requisitions as any[])[0].id;

      const app2Response = await request(app.getHttpServer())
        .post('/api/recruitment/applications')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          requisition_id: requisitionId,
          candidate_id: candidate2Response.body.id,
        });

      const offer2Response = await request(app.getHttpServer())
        .post('/api/recruitment/offers')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          application_id: app2Response.body.id,
          offer_type: 'full_time',
          job_title: 'Software Engineer',
          department_id: departmentId,
          salary_amount: 80000,
          salary_currency: 'ZAR',
          salary_frequency: 'monthly',
          start_date: '2025-02-15',
        });

      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offer2Response.body.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offer2Response.body.id}/send`)
        .set('Authorization', `Bearer ${hrToken}`);

      await request(app.getHttpServer())
        .post(`/api/recruitment/offers/${offer2Response.body.id}/decline`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          decline_reason: 'Accepted offer from another company',
        })
        .expect(200);

      // Verify status
      const [rows] = await pool.execute(
        'SELECT status, decline_reason FROM job_offers WHERE id = ?',
        [offer2Response.body.id]
      );
      expect((rows as any[])[0].status).toBe('declined');
      expect((rows as any[])[0].decline_reason).toBe('Accepted offer from another company');
    });
  });

  // ==================== ONBOARDING ====================

  describe('Onboarding Workflows', () => {
    let workflowId: string;
    let employeeId: string;

    beforeAll(async () => {
      // Create employee for onboarding
      employeeId = uuidv4();
      await pool.execute(
        `INSERT INTO employees (id, employee_number, first_name, last_name, email, legal_entity_id, department_id, position, hire_date, employment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2025-02-01', 'active')`,
        [employeeId, 'EMP' + Math.floor(Math.random() * 10000), 'David', 'Brown', 'david.brown@example.com', legalEntityId, departmentId, 'Software Engineer']
      );
    });

    it('should create an onboarding workflow', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/recruitment/onboarding')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employee_id: employeeId,
          start_date: '2025-02-01',
          department_id: departmentId,
          manager_id: managerId,
          buddy_id: hrId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('not_started');
      expect(response.body.progress_percentage).toBe(0);

      workflowId = response.body.id;
    });

    it('should get onboarding workflow details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/onboarding/${workflowId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.id).toBe(workflowId);
      expect(response.body.employee_id).toBe(employeeId);
    });

    it('should get employee onboarding workflow', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/onboarding/employee/${employeeId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.id).toBe(workflowId);
    });

    it('should get onboarding templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recruitment/onboarding/templates')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should create checklist from template', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/checklist`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          template_id: templateId,
          start_date: '2025-02-01',
        })
        .expect(201);

      // Verify tasks were created
      const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM onboarding_tasks WHERE workflow_id = ?',
        [workflowId]
      );
      expect((rows as any[])[0].count).toBeGreaterThan(0);
    });

    it('should get onboarding tasks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/recruitment/onboarding/${workflowId}/tasks`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should complete an onboarding task', async () => {
      // Get first task
      const [tasks] = await pool.execute(
        'SELECT id FROM onboarding_tasks WHERE workflow_id = ? AND status = ? LIMIT 1',
        [workflowId, 'pending']
      );
      const taskId = (tasks as any[])[0].id;

      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/task/complete`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          task_id: taskId,
          completed_by_id: hrId,
          completion_notes: 'Task completed successfully',
        })
        .expect(200);

      // Verify task status
      const [rows] = await pool.execute(
        'SELECT status, completed_date FROM onboarding_tasks WHERE id = ?',
        [taskId]
      );
      expect((rows as any[])[0].status).toBe('completed');
      expect((rows as any[])[0].completed_date).not.toBeNull();

      // Verify workflow progress updated
      const [workflowRows] = await pool.execute(
        'SELECT progress_percentage FROM onboarding_workflows WHERE id = ?',
        [workflowId]
      );
      expect((workflowRows as any[])[0].progress_percentage).toBeGreaterThan(0);
    });

    it('should add required document', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/document`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          document_type: 'id_copy',
          document_name: 'Copy of ID',
          is_required: true,
        })
        .expect(201);

      // Verify document was created
      const [rows] = await pool.execute(
        'SELECT * FROM onboarding_documents WHERE workflow_id = ? AND document_type = ?',
        [workflowId, 'id_copy']
      );
      expect((rows as any[]).length).toBe(1);
    });

    it('should add equipment request', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/equipment`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          equipment_type: 'laptop',
          equipment_description: 'MacBook Pro 16-inch',
          status: 'pending',
        })
        .expect(201);

      // Verify equipment was created
      const [rows] = await pool.execute(
        'SELECT * FROM onboarding_equipment WHERE workflow_id = ? AND equipment_type = ?',
        [workflowId, 'laptop']
      );
      expect((rows as any[]).length).toBe(1);
    });

    it('should add system access request', async () => {
      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/access`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          system_name: 'email',
          access_level: 'user',
          status: 'pending',
        })
        .expect(201);

      // Verify access was created
      const [rows] = await pool.execute(
        'SELECT * FROM onboarding_access WHERE workflow_id = ? AND system_name = ?',
        [workflowId, 'email']
      );
      expect((rows as any[]).length).toBe(1);
    });

    it('should mark onboarding as complete', async () => {
      // Complete all remaining tasks first
      const [tasks] = await pool.execute(
        'UPDATE onboarding_tasks SET status = ?, completed_date = CURRENT_TIMESTAMP WHERE workflow_id = ? AND status = ?',
        ['completed', workflowId, 'pending']
      );

      await request(app.getHttpServer())
        .post(`/api/recruitment/onboarding/${workflowId}/complete`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Verify workflow status
      const [rows] = await pool.execute(
        'SELECT status, completion_date FROM onboarding_workflows WHERE id = ?',
        [workflowId]
      );
      expect((rows as any[])[0].status).toBe('completed');
      expect((rows as any[])[0].completion_date).not.toBeNull();
    });
  });

  // ==================== SECURITY & PERMISSIONS ====================

  describe('Security & Permissions', () => {
    let employeeToken: string;

    beforeAll(async () => {
      const employee = await createAuthenticatedUser('employee', 'ZAF');
      employeeToken = employee.token;
    });

    it('should deny employee access to create job requisition', async () => {
      await request(app.getHttpServer())
        .post('/api/recruitment/requisitions')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          job_title: 'Test Position',
          job_level: 'mid',
          employment_type: 'permanent',
        })
        .expect(403);
    });

    it('should deny employee access to approve requisition', async () => {
      const [requisitions] = await pool.execute(
        'SELECT id FROM job_requisitions LIMIT 1'
      );
      const requisitionId = (requisitions as any[])[0]?.id;

      if (requisitionId) {
        await request(app.getHttpServer())
          .post(`/api/recruitment/requisitions/${requisitionId}/approve`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .expect(403);
      }
    });

    it('should deny unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/recruitment/requisitions')
        .expect(401);
    });
  });
});
