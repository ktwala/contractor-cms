/**
 * Enterprise Features E2E Tests
 * Tests multi-company consolidation, approval workflows, audit trail, RBAC,
 * data archiving, delegation, cost centers, and bulk operations
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { createAuthenticatedUser, cleanupTestUsers } from '../helpers/auth.helper';
import { cleanupTestData } from '../fixtures/test-data';
import pool from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Enterprise Features (E2E)', () => {
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

  // ==================== MULTI-COMPANY CONSOLIDATION ====================

  describe('Multi-Company Consolidation', () => {
    let groupId: string;

    it('should create a company group', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/company-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          group_name: 'Corporate Group SA',
          group_code: 'CORP-SA',
          parent_company_id: legalEntityId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.group_name).toBe('Corporate Group SA');

      groupId = response.body.id;
    });

    it('should add entity to group', async () => {
      await request(app.getHttpServer())
        .post(`/api/enterprise/company-groups/${groupId}/add-entity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          legal_entity_id: legalEntityId,
          consolidation_percentage: 100,
        })
        .expect(201);
    });

    it('should get company group members', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/company-groups/${groupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get consolidated payroll', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/company-groups/${groupId}/consolidated-payroll`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: '2025-01' })
        .expect(200);

      expect(response.body).toHaveProperty('total_gross_pay');
      expect(response.body).toHaveProperty('total_net_pay');
      expect(response.body).toHaveProperty('by_entity');
    });

    it('should get consolidated compliance', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/company-groups/${groupId}/consolidated-compliance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: '2025-01' })
        .expect(200);

      expect(response.body).toHaveProperty('total_paye');
      expect(response.body).toHaveProperty('total_uif');
      expect(response.body).toHaveProperty('total_sdl');
    });

    it('should get consolidated headcount', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/company-groups/${groupId}/consolidated-headcount`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_employees');
      expect(response.body).toHaveProperty('by_entity');
    });
  });

  // ==================== APPROVAL WORKFLOWS ====================

  describe('Approval Workflows', () => {
    let workflowId: string;
    let requestId: string;

    it('should create an approval workflow', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflow_name: 'Payrun Approval',
          workflow_type: 'payrun_approval',
          auto_approve_threshold: 0,
          max_approval_days: 7,
          escalation_enabled: true,
          escalation_days: 3,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.workflow_name).toBe('Payrun Approval');

      workflowId = response.body.id;
    });

    it('should add workflow steps', async () => {
      await request(app.getHttpServer())
        .post(`/api/enterprise/workflows/${workflowId}/steps`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          step_order: 1,
          step_name: 'Manager Approval',
          approver_role: 'manager',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/enterprise/workflows/${workflowId}/steps`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          step_order: 2,
          step_name: 'Finance Approval',
          approver_role: 'admin',
        })
        .expect(201);
    });

    it('should submit approval request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/approval-requests')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          workflow_id: workflowId,
          entity_type: 'payrun',
          entity_id: uuidv4(),
          amount: 50000,
          requested_by_id: managerId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');

      requestId = response.body.id;
    });

    it('should get pending approvals', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/approval-requests/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should approve request', async () => {
      await request(app.getHttpServer())
        .post(`/api/enterprise/approval-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          approver_id: managerId,
          comments: 'Approved - looks good',
        })
        .expect(200);

      // Verify status progressed
      const [rows] = await pool.execute(
        'SELECT current_step FROM approval_requests WHERE id = ?',
        [requestId]
      );
      expect((rows as any[])[0].current_step).toBe(2);
    });

    it('should reject request', async () => {
      // Create another request to reject
      const rejectResponse = await request(app.getHttpServer())
        .post('/api/enterprise/approval-requests')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          workflow_id: workflowId,
          entity_type: 'payrun',
          entity_id: uuidv4(),
          amount: 30000,
          requested_by_id: managerId,
        });

      await request(app.getHttpServer())
        .post(`/api/enterprise/approval-requests/${rejectResponse.body.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          approver_id: managerId,
          comments: 'Rejected - incorrect data',
        })
        .expect(200);

      // Verify status
      const [rows] = await pool.execute(
        'SELECT status FROM approval_requests WHERE id = ?',
        [rejectResponse.body.id]
      );
      expect((rows as any[])[0].status).toBe('rejected');
    });
  });

  // ==================== AUDIT TRAIL ====================

  describe('Audit Trail', () => {
    it('should log create action', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/audit/log')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminId,
          action_type: 'create',
          entity_type: 'employee',
          entity_id: uuidv4(),
          new_values: { first_name: 'Test', last_name: 'User' },
          severity: 'info',
        })
        .expect(201);
    });

    it('should log update action', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/audit/log')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminId,
          action_type: 'update',
          entity_type: 'employee',
          entity_id: uuidv4(),
          old_values: { salary: 50000 },
          new_values: { salary: 55000 },
          changes: { salary: { from: 50000, to: 55000 } },
          severity: 'warning',
        })
        .expect(201);
    });

    it('should log security event', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/audit/log')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminId,
          action_type: 'login',
          entity_type: 'user',
          entity_id: adminId,
          severity: 'info',
        })
        .expect(201);
    });

    it('should query audit logs by entity', async () => {
      const entityId = uuidv4();

      // Create some audit logs
      await request(app.getHttpServer())
        .post('/api/enterprise/audit/log')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminId,
          action_type: 'create',
          entity_type: 'payrun',
          entity_id: entityId,
          severity: 'info',
        });

      const response = await request(app.getHttpServer())
        .get('/api/enterprise/audit/query')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ entity_id: entityId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should query audit logs by user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/audit/query')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ user_id: adminId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should query audit logs by date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/audit/query')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          date_from: '2025-01-01',
          date_to: '2025-12-31',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== RBAC (Role-Based Access Control) ====================

  describe('RBAC - Role-Based Access Control', () => {
    let roleId: string;
    let permissionId: string;

    it('should create a custom role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/rbac/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role_name: 'Payroll Specialist',
          role_code: 'payroll_specialist',
          description: 'Can process payroll but not approve',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.role_name).toBe('Payroll Specialist');

      roleId = response.body.id;
    });

    it('should get all roles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/rbac/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get all permissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/rbac/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        permissionId = response.body[0].id;
      }
    });

    it('should assign permission to role', async () => {
      if (permissionId) {
        await request(app.getHttpServer())
          .post('/api/enterprise/rbac/role-permissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role_id: roleId,
            permission_id: permissionId,
            grant_type: 'allow',
          })
          .expect(201);
      }
    });

    it('should assign role to user', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/rbac/user-roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: managerId,
          role_id: roleId,
          entity_id: legalEntityId,
          effective_from: '2025-01-01',
        })
        .expect(201);
    });

    it('should get user roles', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/rbac/users/${managerId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get user permissions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/rbac/users/${managerId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should check if user has permission', async () => {
      if (permissionId) {
        const response = await request(app.getHttpServer())
          .get('/api/enterprise/rbac/check-permission')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            user_id: managerId,
            permission_code: 'payroll:read',
          })
          .expect(200);

        expect(response.body).toHaveProperty('has_permission');
      }
    });
  });

  // ==================== DATA ARCHIVING ====================

  describe('Data Archiving & Retention', () => {
    let policyId: string;
    let batchId: string;

    it('should create retention policy', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/archiving/policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          policy_name: 'Payslip Archive Policy',
          entity_type: 'payslip',
          retention_days: 1825, // 5 years
          auto_archive: true,
          delete_after_archive: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.policy_name).toBe('Payslip Archive Policy');

      policyId = response.body.id;
    });

    it('should get retention policies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/archiving/policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should archive records by policy', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/archiving/archive-by-policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          policy_id: policyId,
          archived_by_id: adminId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('batch_id');
      expect(response.body).toHaveProperty('records_archived');

      batchId = response.body.batch_id;
    });

    it('should get archive batches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/archiving/batches')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should restore archived record', async () => {
      // Get an archived record
      const [records] = await pool.execute(
        'SELECT id FROM archived_records WHERE batch_id = ? LIMIT 1',
        [batchId]
      );
      const recordId = (records as any[])[0]?.id;

      if (recordId) {
        await request(app.getHttpServer())
          .post(`/api/enterprise/archiving/restore/${recordId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            restored_by_id: adminId,
          })
          .expect(200);
      }
    });
  });

  // ==================== DELEGATION ====================

  describe('Delegation & Proxy Access', () => {
    let delegationId: string;

    it('should create delegation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/delegations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          delegator_id: adminId,
          delegate_id: managerId,
          delegation_type: 'approval_only',
          start_date: '2025-01-01',
          end_date: '2025-01-31',
          entity_scope: legalEntityId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.is_active).toBe(true);

      delegationId = response.body.id;
    });

    it('should get active delegations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/delegations/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ user_id: adminId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate delegation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/delegations/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          delegator_id: adminId,
          delegate_id: managerId,
          action: 'approve_payrun',
        })
        .expect(200);

      expect(response.body).toHaveProperty('is_valid');
    });

    it('should revoke delegation', async () => {
      await request(app.getHttpServer())
        .post(`/api/enterprise/delegations/${delegationId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          revoked_by_id: adminId,
        })
        .expect(200);

      // Verify delegation is inactive
      const [rows] = await pool.execute(
        'SELECT is_active FROM user_delegations WHERE id = ?',
        [delegationId]
      );
      expect((rows as any[])[0].is_active).toBe(0);
    });
  });

  // ==================== COST CENTERS ====================

  describe('Cost Center Management', () => {
    let costCenterId: string;
    let budgetId: string;

    it('should create cost center', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/cost-centers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cost_center_code: 'IT-001',
          cost_center_name: 'IT Department',
          cost_center_type: 'department',
          legal_entity_id: legalEntityId,
          is_active: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.cost_center_name).toBe('IT Department');

      costCenterId = response.body.id;
    });

    it('should get all cost centers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/cost-centers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allocate employee to cost center', async () => {
      const [employees] = await pool.execute(
        'SELECT id FROM employees LIMIT 1'
      );
      const employeeId = (employees as any[])[0]?.id;

      if (employeeId) {
        await request(app.getHttpServer())
          .post('/api/enterprise/cost-centers/allocations')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            employee_id: employeeId,
            cost_center_id: costCenterId,
            allocation_percentage: 100,
            effective_from: '2025-01-01',
          })
          .expect(201);
      }
    });

    it('should create budget', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/cost-centers/budgets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cost_center_id: costCenterId,
          budget_year: 2025,
          budget_type: 'salaries',
          budget_amount: 1000000,
          alert_threshold_percentage: 90,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      budgetId = response.body.id;
    });

    it('should get budget utilization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/cost-centers/budgets/${budgetId}/utilization`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('budget_amount');
      expect(response.body).toHaveProperty('utilized_amount');
      expect(response.body).toHaveProperty('utilization_percentage');
    });

    it('should get cost center report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/cost-centers/${costCenterId}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: '2025-01' })
        .expect(200);

      expect(response.body).toHaveProperty('cost_center_name');
      expect(response.body).toHaveProperty('total_payroll');
    });
  });

  // ==================== BULK OPERATIONS ====================

  describe('Bulk Operations', () => {
    let jobId: string;

    it('should initiate bulk employee import', async () => {
      const csvData = 'first_name,last_name,email,position\nJohn,Doe,john.doe@test.com,Engineer\nJane,Smith,jane.smith@test.com,Manager';

      const response = await request(app.getHttpServer())
        .post('/api/enterprise/bulk/import-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          csv_data: csvData,
          legal_entity_id: legalEntityId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('job_id');
      expect(response.body.status).toBe('validating');

      jobId = response.body.job_id;
    });

    it('should get bulk job status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/bulk/job/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(jobId);
      expect(response.body).toHaveProperty('status');
    });

    it('should get bulk job items', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/bulk/job/${jobId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get bulk job history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/bulk/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== API USAGE TRACKING ====================

  describe('API Usage Tracking', () => {
    let apiKeyId: string;

    it('should create API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/enterprise/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key_name: 'Integration API Key',
          key_type: 'integration',
          rate_limit_per_minute: 60,
          rate_limit_per_hour: 1000,
          rate_limit_per_day: 10000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('api_key');

      apiKeyId = response.body.id;
    });

    it('should get all API keys', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/enterprise/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get API usage statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/enterprise/api-keys/${apiKeyId}/usage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          date_from: '2025-01-01',
          date_to: '2025-01-31',
        })
        .expect(200);

      expect(response.body).toHaveProperty('total_requests');
      expect(response.body).toHaveProperty('by_endpoint');
    });

    it('should revoke API key', async () => {
      await request(app.getHttpServer())
        .post(`/api/enterprise/api-keys/${apiKeyId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify key is revoked
      const [rows] = await pool.execute(
        'SELECT is_active FROM api_keys WHERE id = ?',
        [apiKeyId]
      );
      expect((rows as any[])[0].is_active).toBe(0);
    });
  });

  // ==================== SECURITY & PERMISSIONS ====================

  describe('Security & Permissions', () => {
    let employeeToken: string;

    beforeAll(async () => {
      const employee = await createAuthenticatedUser('employee', 'ZAF');
      employeeToken = employee.token;
    });

    it('should deny employee access to create company group', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/company-groups')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          group_name: 'Test Group',
        })
        .expect(403);
    });

    it('should deny employee access to RBAC management', async () => {
      await request(app.getHttpServer())
        .post('/api/enterprise/rbac/roles')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          role_name: 'Test Role',
        })
        .expect(403);
    });

    it('should deny unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/enterprise/company-groups')
        .expect(401);
    });
  });
});
