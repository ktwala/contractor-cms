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
import { TestHelper } from './utils/test-helper';
import { GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

describe('Oracle supplier staging import (PR-CMS-OPERATIONS-1D1)', () => {
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

  it('imports mock Oracle JSON into staging with match summary', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
    });
    const prisma = TestHelper.getPrisma();

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

    await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: SupplierStatus.ACTIVE,
        companyName: 'Maseru Logistics Pty Ltd',
        email: 'maseru@test.com',
        country: 'LS',
        countryCode: 'LS',
        externalSupplierNumber: 'SUP-10001',
        taxNumber: 'LS-TAX-10001',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.oracle@test.com',
      password: 'ManagerOra123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('manager.oracle@test.com', 'ManagerOra123!');

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

    expect(importRes.body.summary.imported).toBe(3);
    expect(importRes.body.summary.matched).toBe(1);
    expect(importRes.body.summary.possibleMatch).toBeGreaterThanOrEqual(1);
    expect(importRes.body.summary.new).toBeGreaterThanOrEqual(1);

    const matchedRow = importRes.body.rows.find(
      (r: { externalSupplierId: string }) => r.externalSupplierId === 'ORA-20002',
    );
    expect(matchedRow.matchStatus).toBe('MATCHED');
    expect(matchedRow.matchedSupplier.id).toBe(existing.id);
    expect(matchedRow.matchedSupplier.status).toBe('PENDING_APPROVAL');

    const unchanged = await prisma.supplier.findUnique({ where: { id: existing.id } });
    expect(unchanged?.status).toBe(SupplierStatus.PENDING_APPROVAL);

    const staging = await request(app.getHttpServer())
      .get('/supplier-sources/oracle/staging')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(staging.body.total).toBe(3);

    const audit = await prisma.auditLog.findMany({
      where: { action: 'SUPPLIER_SOURCE_ORACLE_IMPORTED' },
    });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('marks CONFLICT when tax number matches multiple CMS suppliers', async () => {
    const org = await TestHelper.createTestOrganization({
      supplierAuthorityMode: SupplierAuthorityMode.HYBRID,
    });
    const prisma = TestHelper.getPrisma();

    for (const [email, name] of [
      ['a@test.com', 'Supplier A'],
      ['b@test.com', 'Supplier B'],
    ]) {
      await prisma.supplier.create({
        data: {
          organizationId: org.id,
          type: SupplierType.COMPANY,
          status: SupplierStatus.ACTIVE,
          companyName: name,
          email,
          country: 'ZA',
          countryCode: 'ZA',
          taxNumber: 'DUPE-TAX-999',
        },
      });
    }

    await TestHelper.createUserWithRoles(org.id, {
      email: 'manager.oracle2@test.com',
      password: 'ManagerOra2123!',
      roles: [
        {
          role: 'GOVERNANCE_INTEGRATION_OPERATOR',
          orgId: org.id,
          permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token } = await TestHelper.login('manager.oracle2@test.com', 'ManagerOra2123!');

    const res = await request(app.getHttpServer())
      .post('/supplier-sources/oracle/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        suppliers: [
          {
            externalSupplierId: 'ORA-CONFLICT-1',
            name: 'Oracle Conflict',
            countryCode: 'ZA',
            taxRegistrationNumber: 'DUPE-TAX-999',
          },
        ],
      })
      .expect(201);

    expect(res.body.summary.conflict).toBe(1);
    expect(res.body.rows[0].matchStatus).toBe('CONFLICT');
  });
});
