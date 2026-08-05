import { INestApplication } from '@nestjs/common';
import { SupplierAuthorityMode, SupplierType } from '@prisma/client';
import request from 'supertest';
import { SUPPLIER_MASTER_CREATION_FORBIDDEN } from '../src/core/authority/authority.constants';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

function supplierCreatePayload(orgId: string, override?: Record<string, unknown>) {
  return { ...DataFactory.supplier(override), organizationId: orgId };
}

describe('Supplier authority modes (PR-CMS-AUTHORITY-1)', () => {
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

  it('blocks POST /suppliers when supplierAuthorityMode is ORACLE_ONLY', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.authority@test.com',
      password: 'ManagerAuth123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:create', 'suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'manager.authority@test.com',
      'ManagerAuth123!',
    );

    const res = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send(supplierCreatePayload(org.id))
      .expect(403);

    expect(res.body.code).toBe(SUPPLIER_MASTER_CREATION_FORBIDDEN);
  });

  it('allows POST /suppliers when supplierAuthorityMode is CMS_ONLY', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.cmsonly@test.com',
      password: 'ManagerCMS123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:create', 'suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'manager.cmsonly@test.com',
      'ManagerCMS123!',
    );

    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send(supplierCreatePayload(org.id))
      .expect(201);
  });

  it('allows governance intake create on ORACLE_ONLY when explicitly granted', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'intake.authority@test.com',
      password: 'IntakeAuth123!',
      roles: [
        {
          role: 'GOVERNANCE_INTAKE',
          orgId: org.id,
          permissions: ['suppliers:governance-intake', 'suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'intake.authority@test.com',
      'IntakeAuth123!',
    );

    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send(
        supplierCreatePayload(org.id, { email: 'intake-supplier@test.com' }),
      )
      .expect(201);
  });

  it('exposes tenantAuthority on auth profile', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
      contractorAuthorityMode: 'HYBRID',
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'profile.authority@test.com',
      password: 'ProfileAuth123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: ['suppliers:read'],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login(
      'profile.authority@test.com',
      'ProfileAuth123!',
    );

    const profile = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.tenantAuthority.supplierAuthorityMode).toBe('ORACLE_ONLY');
    expect(profile.body.tenantAuthority.contractorAuthorityMode).toBe('HYBRID');
  });
});
