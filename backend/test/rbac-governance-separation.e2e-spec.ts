import { INestApplication, HttpStatus } from '@nestjs/common';
import { execSync } from 'child_process';
import { join } from 'path';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';
import {
  CONTRACTOR_MANAGER_PERMISSIONS,
  GOVERNANCE_AUDITOR_PERMISSIONS,
  GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
  SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS,
} from '../src/core/auth/seed-system-role-bundles';

/**
 * PR-RBAC-REALIGN-3D — negative SoD checks for fine-grained governance permissions.
 */
describe('RBAC governance separation (PR-RBAC-REALIGN-3D)', () => {
  let app: INestApplication;
  let organizationId: string;

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: join(__dirname, '..'),
      stdio: 'pipe',
    });
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    const org = await TestHelper.createTestOrganization();
    organizationId = org.id;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  async function tokenForRole(
    roleName: string,
    permissions: readonly string[],
  ): Promise<string> {
    const password = 'Test123!@#';
    const role = await TestHelper.createTestRole(roleName, [...permissions]);
    const user = await TestHelper.createTestUser(organizationId, {
      email: `${roleName.toLowerCase()}-${Date.now()}@rbac.test`,
      password,
    });
    await TestHelper.assignRole(user.id, role.id, organizationId);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password });
    expect([HttpStatus.OK, HttpStatus.CREATED]).toContain(login.status);
    return login.body.accessToken as string;
  }

  describe('GOVERNANCE_INTEGRATION_OPERATOR', () => {
    let token: string;

    beforeEach(async () => {
      token = await tokenForRole(
        'TEST_INTEGRATION_OPERATOR',
        GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
      );
    });

    it('cannot approve suppliers (403)', async () => {
      await request(app.getHttpServer())
        .get('/suppliers/approvals')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('can list CMS contractors (200)', async () => {
      await request(app.getHttpServer())
        .get('/contractors')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.OK);
    });

    it('cannot create CMS contractors (403)', async () => {
      await request(app.getHttpServer())
        .post('/contractors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierId: '00000000-0000-0000-0000-000000000001',
          firstName: 'No',
          lastName: 'Create',
          email: 'no-create@rbac.test',
          workerClassification: 'SUPPLIER_CONTRACTOR',
          engagementModel: 'DIRECT',
          taxResidency: 'ZA',
        })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('SUPPLIER_GOVERNANCE_REVIEWER', () => {
    let token: string;

    beforeEach(async () => {
      token = await tokenForRole(
        'TEST_SUPPLIER_REVIEWER',
        SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS,
      );
    });

    it('cannot run supplier sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/supplier-sources/oracle/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('cannot run HCM bootstrap sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/contractor-sources/oracle-hcm/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('CONTRACTOR_MANAGER', () => {
    let token: string;

    beforeEach(async () => {
      token = await tokenForRole('TEST_CONTRACTOR_MANAGER', CONTRACTOR_MANAGER_PERMISSIONS);
    });

    it('cannot run supplier sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/supplier-sources/oracle/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('cannot run HCM bootstrap sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/contractor-sources/oracle-hcm/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('GOVERNANCE_AUDITOR', () => {
    let token: string;

    beforeEach(async () => {
      token = await tokenForRole('TEST_GOVERNANCE_AUDITOR', GOVERNANCE_AUDITOR_PERMISSIONS);
    });

    it('cannot POST supplier sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/supplier-sources/oracle/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('cannot POST HCM bootstrap sync (403)', async () => {
      await request(app.getHttpServer())
        .post('/contractor-sources/oracle-hcm/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('cannot POST supplier governance scan (403)', async () => {
      await request(app.getHttpServer())
        .post('/supplier-sources/oracle/drift/detect')
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
