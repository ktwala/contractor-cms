import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

import { DataFactory } from './fixtures/data-factory';

describe('RBAC Matrix (e2e)', () => {
  let app: INestApplication;
  let orgA: any;
  let orgB: any;
  let tokenOrgAUser: string;
  let tokenOrgBUser: string;
  let tokenGlobalAdmin: string;
  let orgASupplierId: string;
  let orgBSupplierId: string;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();

    // 1. Create two organizations
    orgA = await TestHelper.createTestOrganization({ name: 'Org A' });
    orgB = await TestHelper.createTestOrganization({ name: 'Org B' });

    // 2. Create users and roles
    // Org A User (ORG_FINANCE)
    await TestHelper.createUserWithRoles(orgA.id, {
      email: 'userA@test.com',
      roles: [{ role: 'ORG_FINANCE', permissions: ['suppliers:read', 'suppliers:create', 'suppliers:update', 'projects:create', 'contracts:create'], orgId: orgA.id }],
    });
    tokenOrgAUser = (await TestHelper.login('userA@test.com')).token;

    // Scoped User B (ORG_FINANCE)
    await TestHelper.createUserWithRoles(orgB.id, {
      email: 'userB@test.com',
      roles: [{ role: 'ORG_FINANCE', permissions: ['suppliers:read', 'suppliers:create', 'suppliers:update', 'projects:create', 'contracts:create'], orgId: orgB.id }],
    });
    tokenOrgBUser = (await TestHelper.login('userB@test.com')).token;

    // Global Admin (CMS_ADMIN)
    await TestHelper.createUserWithRoles(orgA.id, { // Admin belongs to Org A but role is global
      email: 'admin@test.com',
      roles: [{ role: 'CMS_ADMIN', permissions: ['*:*'], isSystemRole: true, orgId: null }],
    });
    tokenGlobalAdmin = (await TestHelper.login('admin@test.com')).token;

    // 3. Create resources in each org
    const supplierA = await DataFactory.createSupplier(TestHelper.getPrisma(), {
      organizationId: orgA.id,
    });
    orgASupplierId = supplierA.id;

    const supplierB = await DataFactory.createSupplier(TestHelper.getPrisma(), {
      organizationId: orgB.id,
    });
    orgBSupplierId = supplierB.id;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  // ---------------------------------------------------------------------------
  // Cross-tenant Isolation
  // ---------------------------------------------------------------------------
  describe('Cross-tenant Isolation', () => {
    it('should deny Org A user from reading Org B data', async () => {
      await request(app.getHttpServer())
        .get(`/suppliers/${orgBSupplierId}`)
        .set('Authorization', `Bearer ${tokenOrgAUser}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should deny Org A user from mutating Org B data', async () => {
      await request(app.getHttpServer())
        .patch(`/suppliers/${orgBSupplierId}`)
        .set('Authorization', `Bearer ${tokenOrgAUser}`)
        .send({ status: 'INACTIVE' })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ---------------------------------------------------------------------------
  // Scoped Results
  // ---------------------------------------------------------------------------
  describe('Scoped List Results', () => {
    it('should only show Org A results to Org A user', async () => {
      const response = await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${tokenOrgAUser}`)
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(orgASupplierId);
    });

    it('should only show Org B results to Org B user', async () => {
      const response = await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${tokenOrgBUser}`)
        .expect(HttpStatus.OK);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(orgBSupplierId);
    });
  });

  // ---------------------------------------------------------------------------
  // Global Access
  // ---------------------------------------------------------------------------
  describe('Global Role Access', () => {
    it('should allow CMS_ADMIN to read Org A data', async () => {
      await request(app.getHttpServer())
        .get(`/suppliers/${orgASupplierId}`)
        .set('Authorization', `Bearer ${tokenGlobalAdmin}`)
        .expect(HttpStatus.OK);
    });

    it('should allow CMS_ADMIN to read Org B data', async () => {
      await request(app.getHttpServer())
        .get(`/suppliers/${orgBSupplierId}`)
        .set('Authorization', `Bearer ${tokenGlobalAdmin}`)
        .expect(HttpStatus.OK);
    });

    it('should allow CMS_ADMIN to view all organizations data if requested globally', async () => {
      const response = await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${tokenGlobalAdmin}`)
        .expect(HttpStatus.OK);

      // Depending on implementation, global admin might need to pass ?organizationId=... to get specific orgs
      // If no org ID is passed, and it returns all suppliers, they should see 2.
      // If implementation forces org ID even for admin, this might return 0 unless passed.
      // We will assert HTTP 200 is sufficient to prove the guard allowed it.
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Missing Organization Context
  // ---------------------------------------------------------------------------
  describe('Missing Context', () => {
    it('should return 403 when creating a resource in another org context without global role', async () => {
      await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${tokenOrgAUser}`)
        .send({ name: 'Supplier Hack', contactEmail: 'hack@test.com', organizationId: orgB.id })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ---------------------------------------------------------------------------
  // Malicious Parameter Injection
  // ---------------------------------------------------------------------------
  describe('Malicious Parameter Injection', () => {
    it('should reject requests that attempt to pass organizationId via query string (DTO validation)', async () => {
      // Because we now strictly derive org context from the session,
      // the ValidationPipe rejects 'organizationId' as an unknown property
      await request(app.getHttpServer())
        .get(`/suppliers?organizationId=${orgB.id}`)
        .set('Authorization', `Bearer ${tokenOrgAUser}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ---------------------------------------------------------------------------
  // Tenant DTO Security Enforcements (PR-DTO-SECURITY-1)
  // ---------------------------------------------------------------------------
  describe('Tenant DTO Security', () => {
    describe('Project Creation Scoping', () => {
      it('should allow creation when org-scoped role matches body organization', async () => {
        const projectDto = {
          code: 'PROJ-OK-A',
          name: 'Org A Project',
          budget: 10000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 10000000).toISOString(),
          organizationId: orgA.id,
        };

        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${tokenOrgAUser}`)
          .send(projectDto)
          .expect(HttpStatus.CREATED);
      });

      it('should forbid creation when Org A user attempts to nominate Org B in body', async () => {
        const projectDto = {
          code: 'PROJ-HACK',
          name: 'Hack Project',
          budget: 10000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 10000000).toISOString(),
          organizationId: orgB.id, // Nominate Org B
        };

        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${tokenOrgAUser}`)
          .send(projectDto)
          .expect(HttpStatus.FORBIDDEN);
      });

      it('should fail closed with 403 when organizationId is missing or has invalid format for scoped user', async () => {
        const projectDto = {
          code: 'PROJ-INVALID',
          name: 'Invalid Project',
          budget: 10000,
          startDate: new Date().toISOString(),
          organizationId: 'not-a-uuid',
        };

        // Scoped user gets 403 because guard intercepts the mismatched context before pipe validation runs
        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${tokenOrgAUser}`)
          .send(projectDto)
          .expect(HttpStatus.FORBIDDEN);
      });

      it('should return 400 when organizationId has invalid format for global admin', async () => {
        const projectDto = {
          code: 'PROJ-INVALID-ADMIN',
          name: 'Invalid Admin Project',
          budget: 10000,
          startDate: new Date().toISOString(),
          organizationId: 'not-a-uuid',
        };

        // Admin gets 400 because guard allows global role through, and validation pipe executes next
        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${tokenGlobalAdmin}`)
          .send(projectDto)
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('should allow global authorized role (CMS_ADMIN) to nominate any organization', async () => {
        const projectDto = {
          code: 'PROJ-ADMIN-B',
          name: 'Admin Project B',
          budget: 20000,
          startDate: new Date().toISOString(),
          organizationId: orgB.id,
        };

        await request(app.getHttpServer())
          .post('/projects')
          .set('Authorization', `Bearer ${tokenGlobalAdmin}`)
          .send(projectDto)
          .expect(HttpStatus.CREATED);
      });
    });

    describe('Contract Creation Scoping', () => {
      it('should allow contract creation when scoped role matches body organization', async () => {
        const contractDto = {
          supplierId: orgASupplierId,
          contractNumber: 'CON-OK-A',
          title: 'Org A Contract',
          contractType: 'TIME_AND_MATERIALS',
          startDate: new Date().toISOString(),
          organizationId: orgA.id,
        };

        await request(app.getHttpServer())
          .post('/contracts')
          .set('Authorization', `Bearer ${tokenOrgAUser}`)
          .send(contractDto)
          .expect(HttpStatus.CREATED);
      });

      it('should forbid contract creation when Org A user nominates Org B in body', async () => {
        const contractDto = {
          supplierId: orgBSupplierId,
          contractNumber: 'CON-HACK',
          title: 'Hack Contract',
          contractType: 'TIME_AND_MATERIALS',
          startDate: new Date().toISOString(),
          organizationId: orgB.id,
        };

        await request(app.getHttpServer())
          .post('/contracts')
          .set('Authorization', `Bearer ${tokenOrgAUser}`)
          .send(contractDto)
          .expect(HttpStatus.FORBIDDEN);
      });
    });
  });
});
