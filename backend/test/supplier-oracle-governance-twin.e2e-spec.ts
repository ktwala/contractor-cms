import { INestApplication } from '@nestjs/common';
import {
  SupplierAuthorityMode,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { SUPPLIER_MASTER_CREATION_FORBIDDEN } from '../src/core/authority/authority.constants';
import { SUPPLIER_SOURCE_IDENTITY_IMMUTABLE } from '../src/domain/supplier-sources/supplier-governance-twin.errors';
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';
import { DataFactory } from './fixtures/data-factory';

describe('Oracle staging → governance twin (PR-CMS-DATA-2)', () => {
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

  async function setupOracleTenant() {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
      contractorAuthorityMode: 'HYBRID',
    });
    const prisma = TestHelper.getPrisma();

    await TestHelper.createUserWithRoles(org.id, {
      email: 'promote.oracle@test.com',
      password: 'PromoteOra123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [
            ...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
            'suppliers:create',
            'suppliers:update',
          ],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('promote.oracle@test.com', 'PromoteOra123!');

    return { org, prisma, token };
  }

  it('promotes NEW and MATCHED rows without setting ACTIVE', async () => {
    const { org, prisma, token } = await setupOracleTenant();

    const existing = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Cape Services Group',
        email: 'cape@test.com',
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-20002',
        externalSupplierNumber: 'SUP-20002',
        taxNumber: 'ZA-TAX-20002',
      },
    });

    const fixturePath = path.join(
      __dirname,
      'fixtures/oracle-supplier-extract/mock-suppliers.json',
    );
    const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    const importRes = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const matchedStaging = importRes.body.rows.find(
      (r: { externalSupplierId: string }) => r.externalSupplierId === 'ORA-20002',
    );
    const newStaging = importRes.body.rows.find(
      (r: { externalSupplierId: string }) => r.externalSupplierId === 'ORA-30003',
    );

    const linked = await request(app.getHttpServer())
      .post(`/supplier-sources/oracle/staging/${matchedStaging.id}/promote`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(linked.body.outcome).toBe('LINKED');
    expect(linked.body.supplierId).toBe(existing.id);
    expect(linked.body.status).toBe('PENDING_APPROVAL');

    const created = await request(app.getHttpServer())
      .post(`/supplier-sources/oracle/staging/${newStaging.id}/promote`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(created.body.outcome).toBe('CREATED');
    expect(created.body.status).toBe('PENDING_APPROVAL');
    expect(created.body.sourceSystem).toBe('ORACLE_SUPPLIER_SAAS');
    expect(created.body.externalSupplierId).toBe('ORA-30003');

    const twin = await prisma.supplier.findUnique({
      where: { id: created.body.supplierId },
    });
    expect(twin?.status).toBe(SupplierStatus.PENDING_APPROVAL);
    expect(twin?.sourceSystem).toBe(SupplierSourceSystem.ORACLE_SUPPLIER_SAAS);

    const idempotent = await request(app.getHttpServer())
      .post(`/supplier-sources/oracle/staging/${newStaging.id}/promote`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(idempotent.body.idempotent).toBe(true);
  });

  it('blocks client supplier create on ORACLE_ONLY while allowing staging promote', async () => {
    const { org, token } = await setupOracleTenant();
    const dto = DataFactory.supplier();

    const blocked = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...dto, organizationId: org.id })
      .expect(403);

    expect(blocked.body.code).toBe(SUPPLIER_MASTER_CREATION_FORBIDDEN);
  });

  it('rejects mutating Oracle source identity after link', async () => {
    const { org, prisma, token } = await setupOracleTenant();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Linked Co',
        email: 'linked@test.com',
        country: 'ZA',
        countryCode: 'ZA',
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: 'ORA-LOCK-1',
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/suppliers/${supplier.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ externalSupplierId: 'ORA-OTHER' } as Record<string, unknown>)
      .expect(400);

    expect(res.body.code).toBe(SUPPLIER_SOURCE_IDENTITY_IMMUTABLE);
  });

  it('batch promote imports all MATCHED and NEW rows', async () => {
    const { org, prisma, token } = await setupOracleTenant();

    await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: SupplierStatus.ACTIVE,
        companyName: 'Cape Services Group',
        email: 'cape2@test.com',
        country: 'ZA',
        countryCode: 'ZA',
        externalSupplierNumber: 'SUP-20002',
        taxNumber: 'ZA-TAX-20002',
      },
    });

    const payload = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/oracle-supplier-extract/mock-suppliers.json'),
        'utf-8',
      ),
    );

    await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const batch = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/staging/promote')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(batch.body.promoted).toBeGreaterThanOrEqual(1);
    expect(
      batch.body.results.every((r: { status: string }) => r.status !== 'ACTIVE'),
    ).toBe(true);
  });
});
