import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
} from '../src/core/auth/permissions.constants';
import { FINANCE_SENSITIVE_PERMISSIONS } from '../src/core/auth/utils/permission-evaluation';

/**
 * RBAC Permission Engine E2E Tests
 *
 * Validates the full permission lifecycle:
 * - Wildcard evaluation (*:*, resource:*)
 * - Explicit permission matching
 * - Multi-role union semantics
 * - /auth/profile contract (roles, effectivePermissions)
 * - Negative cases (no roles, wrong permissions, no wildcard)
 * - Org-scope warning (deferred enforcement)
 */
describe('RBAC Permission Engine E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  // -------------------------------------------------------------------------
  // Wildcard: *:*
  // -------------------------------------------------------------------------

  describe('Wildcard: *:*', () => {
    let token: string;
    let organizationId: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization();
      organizationId = org.id;
      await TestHelper.createUserWithRoles(org.id, {
        email: 'admin@test.com',
        roles: [
          { role: 'CMS_ADMIN', permissions: ['*:*'], isSystemRole: true },
        ],
      });
      const login = await TestHelper.login('admin@test.com');
      token = login.token;
    });

    it('CMS_ADMIN can access suppliers (suppliers:read)', async () => {
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('CMS_ADMIN can access analytics (analytics:read)', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('CMS_ADMIN can access organizations (organizations:read)', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // -------------------------------------------------------------------------
  // Explicit permissions
  // -------------------------------------------------------------------------

  describe('Explicit permissions', () => {
    let financeToken: string;
    let organizationId: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization();
      organizationId = org.id;
      await TestHelper.createUserWithRoles(org.id, {
        email: 'finance@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: [
              'invoices:read',
              'invoices:approve',
              'suppliers:read',
              'contractors:read',
              'timesheets:read',
              'timesheets:approve',
            ],
          },
        ],
      });
      const login = await TestHelper.login('finance@test.com');
      financeToken = login.token;
    });

    it('FINANCE_USER can read invoices', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(200);
    });

    it('FINANCE_USER can read suppliers', async () => {
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(200);
    });

    it('FINANCE_USER cannot create suppliers (missing suppliers:create)', async () => {
      await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Test',
          lastName: 'Supplier',
          email: 'blocked@test.com',
          country: 'ZA',
        })
        .expect(403);
    });

    it('FINANCE_USER cannot access analytics (missing analytics:read)', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(403);
    });

    it('FINANCE_USER cannot access organizations (missing organizations:read)', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // Resource wildcards (resource:*)
  // -------------------------------------------------------------------------

  describe('Resource wildcards (resource:*)', () => {
    let supplierWildcardToken: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'supplier-manager@test.com',
        roles: [
          {
            role: 'SUPPLIER_MANAGER',
            permissions: ['suppliers:*'],
          },
        ],
      });
      const login = await TestHelper.login('supplier-manager@test.com');
      supplierWildcardToken = login.token;
    });

    it('user with suppliers:* can read suppliers', async () => {
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${supplierWildcardToken}`)
        .expect(200);
    });

    it('user with suppliers:* cannot access invoices (no invoice permissions)', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${supplierWildcardToken}`)
        .expect(403);
    });

    it('user with suppliers:* cannot access analytics', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${supplierWildcardToken}`)
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-role users
  // -------------------------------------------------------------------------

  describe('Multi-role users', () => {
    let multiRoleToken: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'multi@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: [
              'invoices:read',
              'invoices:approve',
              'suppliers:read',
            ],
          },
          {
            role: 'PROJECT_VIEWER',
            permissions: ['projects:read', 'analytics:read'],
          },
        ],
      });
      const login = await TestHelper.login('multi@test.com');
      multiRoleToken = login.token;
    });

    it('multi-role user can read invoices (from FINANCE_USER)', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${multiRoleToken}`)
        .expect(200);
    });

    it('multi-role user can read analytics (from PROJECT_VIEWER)', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${multiRoleToken}`)
        .expect(200);
    });

    it('multi-role user cannot create suppliers (neither role has suppliers:create)', async () => {
      await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${multiRoleToken}`)
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Test',
          lastName: 'Blocked',
          email: 'blocked@test.com',
          country: 'ZA',
        })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // No permissions — negative cases
  // -------------------------------------------------------------------------

  describe('No permissions', () => {
    it('authenticated user with empty role permissions gets 403 on guarded endpoints', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'empty@test.com',
        roles: [{ role: 'EMPTY_ROLE', permissions: [] }],
      });
      const login = await TestHelper.login('empty@test.com');

      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(403);
    });

    it('authenticated user with no roles at all gets 403', async () => {
      const org = await TestHelper.createTestOrganization();
      // Create user with no roles — use createTestUser directly
      await TestHelper.createTestUser(org.id, {
        email: 'noroles@test.com',
      });
      const login = await TestHelper.login('noroles@test.com');

      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(403);
    });

    it('user without wildcard cannot access all endpoints', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'limited@test.com',
        roles: [
          {
            role: 'LIMITED',
            permissions: ['suppliers:read'],
          },
        ],
      });
      const login = await TestHelper.login('limited@test.com');

      // Can read suppliers
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(200);

      // Cannot read invoices
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(403);

      // Cannot read contractors
      await request(app.getHttpServer())
        .get('/contractors')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(403);

      // Cannot read analytics
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // PR-RBAC-REALIGN-1 — external worker vs org-wide invoices
  // -------------------------------------------------------------------------

  describe('PR-RBAC-REALIGN-1: contractor invoice boundary', () => {
    let contractorToken: string;
    let financeToken: string;
    let adminToken: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'worker-invoice@test.com',
        roles: [
          {
            role: 'CONTRACTOR',
            isSystemRole: true,
            permissions: [
              'timesheets:create',
              'timesheets:read',
              'timesheets:update',
              'profile:read',
              'profile:update',
            ],
          },
        ],
      });
      await TestHelper.createUserWithRoles(org.id, {
        email: 'finance-invoice@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: [
              'invoices:read',
              'invoices:approve',
              'suppliers:read',
              'contractors:read',
              'timesheets:read',
              'timesheets:approve',
            ],
          },
        ],
      });
      await TestHelper.createUserWithRoles(org.id, {
        email: 'admin-invoice@test.com',
        roles: [
          { role: 'CMS_ADMIN', permissions: ['*:*'], isSystemRole: true },
        ],
      });

      contractorToken = (await TestHelper.login('worker-invoice@test.com')).token;
      financeToken = (await TestHelper.login('finance-invoice@test.com')).token;
      adminToken = (await TestHelper.login('admin-invoice@test.com')).token;
    });

    it('CONTRACTOR cannot list org-wide invoices (GET /invoices → 403)', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${contractorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('CONTRACTOR retains self-service timesheet list (GET /timesheets → 200)', async () => {
      await request(app.getHttpServer())
        .get('/timesheets')
        .set('Authorization', `Bearer ${contractorToken}`)
        .expect(HttpStatus.OK);
    });

    it('CONTRACTOR profile effectivePermissions omit invoices:read', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${contractorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.effectivePermissions).not.toContain('invoices:read');
    });

    it('FINANCE_USER can list invoices', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(HttpStatus.OK);
    });

    it('CMS_ADMIN can list invoices', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });
  });

  // -------------------------------------------------------------------------
  // /auth/profile contract
  // -------------------------------------------------------------------------

  describe('/auth/profile contract', () => {
    it('returns roles array with permission details', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'profile-test@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: ['invoices:read', 'invoices:approve'],
          },
        ],
      });
      const login = await TestHelper.login('profile-test@test.com');

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(200);

      // roles should be an array of objects with name, permissions, organizationId
      expect(response.body.roles).toBeDefined();
      expect(Array.isArray(response.body.roles)).toBe(true);
      expect(response.body.roles.length).toBe(1);
      expect(response.body.roles[0]).toMatchObject({
        name: 'FINANCE_USER',
        permissions: ['invoices:read', 'invoices:approve'],
      });
      expect(response.body.roles[0]).toHaveProperty('organizationId');
    });

    it('returns effectivePermissions array', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'effective-test@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: ['invoices:read', 'suppliers:read'],
          },
        ],
      });
      const login = await TestHelper.login('effective-test@test.com');

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(200);

      expect(response.body.effectivePermissions).toBeDefined();
      expect(Array.isArray(response.body.effectivePermissions)).toBe(true);
      expect(response.body.effectivePermissions).toContain('invoices:read');
      expect(response.body.effectivePermissions).toContain('suppliers:read');
    });

    it('CMS_ADMIN effectivePermissions include operations but not finance-sensitive grants', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'admin-full@test.com',
        roles: [
          {
            role: 'CMS_ADMIN',
            permissions: ['*:*'],
            isSystemRole: true,
          },
        ],
      });
      const login = await TestHelper.login('admin-full@test.com');

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(200);

      expect(response.body.effectivePermissions).toContain(PERMISSIONS.INVOICES.READ);
      expect(response.body.effectivePermissions).toContain(PERMISSIONS.SUPPLIERS.READ);
      for (const perm of FINANCE_SENSITIVE_PERMISSIONS) {
        expect(response.body.effectivePermissions).not.toContain(perm);
      }
      expect(ALL_PERMISSIONS.size).toBeGreaterThan(
        response.body.effectivePermissions.length,
      );
    });

    it('resource wildcard expands correctly in effectivePermissions', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'wildcard-expand@test.com',
        roles: [
          {
            role: 'SUPPLIER_ALL',
            permissions: ['suppliers:*'],
          },
        ],
      });
      const login = await TestHelper.login('wildcard-expand@test.com');

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${login.token}`)
        .expect(200);

      // Should expand suppliers:* to all supplier actions
      expect(response.body.effectivePermissions).toContain('suppliers:create');
      expect(response.body.effectivePermissions).toContain('suppliers:read');
      expect(response.body.effectivePermissions).toContain('suppliers:update');
      expect(response.body.effectivePermissions).toContain('suppliers:delete');

      // Should NOT include other resources
      expect(response.body.effectivePermissions).not.toContain('invoices:read');
    });

    it('login response includes roles and effectivePermissions', async () => {
      const org = await TestHelper.createTestOrganization();
      await TestHelper.createUserWithRoles(org.id, {
        email: 'login-response@test.com',
        roles: [
          {
            role: 'FINANCE_USER',
            permissions: ['invoices:read', 'invoices:approve'],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login-response@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      expect(response.body.user.roles).toBeDefined();
      expect(response.body.user.roles).toContain('FINANCE_USER');
      expect(response.body.user.effectivePermissions).toBeDefined();
      expect(response.body.user.effectivePermissions).toContain('invoices:read');
    });
  });

  // -------------------------------------------------------------------------
});
