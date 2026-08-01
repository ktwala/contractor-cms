import { INestApplication, HttpStatus } from '@nestjs/common';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ContractType,
  ContractorMigrationAuditAction,
  HcmStagingValidationStatus,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { CONTRACTOR_MIGRATED_EVENT_TYPE } from '../src/domain/contractor-migration/types/contractor-migrated-iga-event.types';
import { TestHelper } from './utils/test-helper';

const ADMIN_BASE = '/admin/contractor-migration';
const MIGRATION_READ = ['contractor-migration:read'];
const MIGRATION_BOOTSTRAP = [
  'contractor-migration:read',
  'contractors:bootstrap',
];
const WORKSHOP_SPONSOR_REF = 'cms:emp:sponsor-demo';

function workshopFixtureContent(): string {
  return readFileSync(
    join(__dirname, 'fixtures/hcm-extract/workshop-sample.json'),
    'utf8',
  );
}

async function seedWorkshopTenant(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  const supplier = await prisma.supplier.create({
    data: {
      organizationId,
      type: SupplierType.COMPANY,
      status: 'ACTIVE',
      companyName: 'Demo Supplier Ltd',
      email: `ws-supplier-${Date.now()}@test.com`,
      country: 'ZA',
    },
  });

  await prisma.supplierContract.create({
    data: {
      organizationId,
      supplierId: supplier.id,
      contractNumber: `WS-MSA-${Date.now()}`,
      contractType: ContractType.TIME_AND_MATERIALS,
      title: 'Workshop MSA',
      startDate: new Date('2024-01-01'),
      status: 'ACTIVE',
    },
  });
}

/**
 * PR-CTR-6B — admin API operator path + permission / org-context guards.
 */
describe('Contractor migration admin API (PR-CTR-6B)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: join(__dirname, '..'),
      stdio: 'pipe',
    });
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('operator path (scoped migration manager)', () => {
    let organizationId: string;
    let token: string;
    let batchId: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization({ code: 'HCMADM' });
      organizationId = org.id;
      await seedWorkshopTenant(organizationId);

      await TestHelper.createUserWithRoles(organizationId, {
        email: 'migration.ops@test.com',
        roles: [
          {
            role: 'MIGRATION_OPERATOR',
            permissions: MIGRATION_BOOTSTRAP,
          },
        ],
      });
      const login = await TestHelper.login('migration.ops@test.com');
      token = login.token;
    });

    it('runs ingest → validate → review → promote with DB + IGA evidence', async () => {
      const prisma = TestHelper.getPrisma();
      const server = app.getHttpServer();

      const ingest = await request(server)
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          format: 'json',
          content: workshopFixtureContent(),
          fileName: 'workshop-sample.json',
          waveLabel: 'E2E_ADMIN',
        })
        .expect(HttpStatus.CREATED);

      expect(ingest.body.inserted).toBe(2);
      batchId = ingest.body.migrationBatchId;
      expect(batchId).toBeTruthy();

      const validate = await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/validate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.CREATED);

      expect(validate.body.validated).toBe(2);
      const passed = validate.body.results.filter(
        (r: { validationStatus: string }) =>
          r.validationStatus === HcmStagingValidationStatus.PASSED,
      );
      const quarantined = validate.body.results.filter(
        (r: { validationStatus: string }) =>
          r.validationStatus === HcmStagingValidationStatus.QUARANTINED,
      );
      expect(passed).toHaveLength(1);
      expect(quarantined).toHaveLength(1);

      const staging = await request(server)
        .get(`${ADMIN_BASE}/batches/${batchId}/staging`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(staging.body.total).toBe(2);
      expect(
        staging.body.items.some(
          (r: { validationStatus: string }) =>
            r.validationStatus === HcmStagingValidationStatus.PASSED,
        ),
      ).toBe(true);
      expect(
        staging.body.items.some(
          (r: { validationStatus: string }) =>
            r.validationStatus === HcmStagingValidationStatus.QUARANTINED,
        ),
      ).toBe(true);

      const quarantine = await request(server)
        .get(`${ADMIN_BASE}/batches/${batchId}/quarantine`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(quarantine.body.total).toBeGreaterThanOrEqual(1);

      const promote = await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ publishToIga: true })
        .expect(HttpStatus.CREATED);

      expect(promote.body.attempted).toBe(1);
      expect(promote.body.results[0].success).toBe(true);
      const ctrId = promote.body.results[0].contractorBusinessId as string;
      expect(ctrId).toMatch(/^CTR-HCMADM-/);

      const contractor = await prisma.contractor.findFirst({
        where: { contractorBusinessId: ctrId },
      });
      expect(contractor).toBeTruthy();
      expect(contractor?.legacySourcePersonId).toBe('hcm-ws-active-001');

      const identityMap = await prisma.contractorIdentityMap.findUnique({
        where: { contractorBusinessId: ctrId },
      });
      expect(identityMap?.legacyHcmPersonId).toBe('hcm-ws-active-001');

      const promotedAudit = await prisma.contractorMigrationAudit.findFirst({
        where: {
          migrationBatchId: batchId,
          action: ContractorMigrationAuditAction.PROMOTED,
        },
      });
      expect(promotedAudit).toBeTruthy();

      const igaEvent = await prisma.igaOutboxEvent.findFirst({
        where: {
          organizationId,
          eventType: CONTRACTOR_MIGRATED_EVENT_TYPE,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(igaEvent).toBeTruthy();
      const payload = igaEvent!.payloadJson as Record<string, unknown>;
      expect(payload.contractorBusinessId).toBe(ctrId);
      expect(payload.legacyHcmPersonId).toBe('hcm-ws-active-001');
      expect(payload.responsibleManagerEmployeeId).toBe(WORKSHOP_SPONSOR_REF);

      const batchDetail = await request(server)
        .get(`${ADMIN_BASE}/batches/${batchId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(batchDetail.body.id).toBe(batchId);
      expect(batchDetail.body.stagingCounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            validationStatus: HcmStagingValidationStatus.PROMOTED,
            count: 1,
          }),
        ]),
      );
    });
  });

  describe('permission guards', () => {
    let organizationId: string;
    let batchId: string;
    let manageToken: string;
    let readToken: string;
    let noPermToken: string;

    beforeEach(async () => {
      const org = await TestHelper.createTestOrganization({ code: 'MIGRBAC' });
      organizationId = org.id;
      await seedWorkshopTenant(organizationId);

      await TestHelper.createUserWithRoles(organizationId, {
        email: 'migration.manage@test.com',
        roles: [
          { role: 'MIGRATION_BOOTSTRAP', permissions: MIGRATION_BOOTSTRAP },
        ],
      });
      await TestHelper.createUserWithRoles(organizationId, {
        email: 'migration.read@test.com',
        roles: [{ role: 'MIGRATION_READ', permissions: MIGRATION_READ }],
      });
      await TestHelper.createUserWithRoles(organizationId, {
        email: 'migration.none@test.com',
        roles: [{ role: 'OTHER', permissions: ['contractors:read'] }],
      });

      manageToken = (await TestHelper.login('migration.manage@test.com')).token;
      readToken = (await TestHelper.login('migration.read@test.com')).token;
      noPermToken = (await TestHelper.login('migration.none@test.com')).token;

      const ingest = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${manageToken}`)
        .send({
          format: 'json',
          content: workshopFixtureContent(),
          fileName: 'rbac-sample.json',
        })
        .expect(HttpStatus.CREATED);

      batchId = ingest.body.migrationBatchId;
    });

    it('denies all routes without migration permissions', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get(`${ADMIN_BASE}/batches`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(403);

      await request(server)
        .get(`${ADMIN_BASE}/batches/${batchId}`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(403);

      await request(server)
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .send({ format: 'json', content: '[]' })
        .expect(403);
    });

    it('allows read routes with contractor-migration:read only', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get(`${ADMIN_BASE}/batches`)
        .set('Authorization', `Bearer ${readToken}`)
        .expect(200);

      await request(server)
        .get(`${ADMIN_BASE}/batches/${batchId}/staging`)
        .set('Authorization', `Bearer ${readToken}`)
        .expect(200);
    });

    it('denies write routes without contractors:bootstrap', async () => {
      const server = app.getHttpServer();
      await request(server)
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${readToken}`)
        .send({ format: 'json', content: workshopFixtureContent() })
        .expect(403);

      await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/validate`)
        .set('Authorization', `Bearer ${readToken}`)
        .expect(403);

      await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/promote`)
        .set('Authorization', `Bearer ${readToken}`)
        .send({ publishToIga: true })
        .expect(403);
    });

    it('allows write routes with contractors:bootstrap', async () => {
      await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/${batchId}/validate`)
        .set('Authorization', `Bearer ${manageToken}`)
        .expect(HttpStatus.CREATED);
    });
  });

  describe('organization context guards', () => {
    it('rejects scoped user passing another organizationId', async () => {
      const orgA = await TestHelper.createTestOrganization({ code: 'ORGA' });
      const orgB = await TestHelper.createTestOrganization({ code: 'ORGB' });
      await seedWorkshopTenant(orgA.id);

      await TestHelper.createUserWithRoles(orgA.id, {
        email: 'scoped.migration@test.com',
        roles: [
          { role: 'MIGRATION_SCOPED', permissions: MIGRATION_BOOTSTRAP },
        ],
      });
      const token = (await TestHelper.login('scoped.migration@test.com')).token;

      await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          organizationId: orgB.id,
          format: 'json',
          content: workshopFixtureContent(),
        })
        .expect(400);

      await request(app.getHttpServer())
        .get(`${ADMIN_BASE}/batches`)
        .query({ organizationId: orgB.id })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('allows global CMS_ADMIN to pass organizationId', async () => {
      const org = await TestHelper.createTestOrganization({ code: 'GLBMIG' });
      await seedWorkshopTenant(org.id);

      await TestHelper.createUserWithRoles(null, {
        email: 'global.migration@test.com',
        roles: [
          {
            role: 'CMS_ADMIN_GLOBAL',
            permissions: ['*:*'],
            isSystemRole: true,
            orgId: null,
          },
        ],
      });
      const token = (await TestHelper.login('global.migration@test.com')).token;

      const ingest = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          organizationId: org.id,
          format: 'json',
          content: workshopFixtureContent(),
          fileName: 'global-admin.json',
        })
        .expect(HttpStatus.CREATED);

      expect(ingest.body.organizationId).toBe(org.id);
      expect(ingest.body.inserted).toBe(2);

      const list = await request(app.getHttpServer())
        .get(`${ADMIN_BASE}/batches`)
        .query({ organizationId: org.id })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(list.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('promote idempotency', () => {
    it('does not re-promote rows on a second promote call', async () => {
      const org = await TestHelper.createTestOrganization({ code: 'IDEMP' });
      await seedWorkshopTenant(org.id);

      await TestHelper.createUserWithRoles(org.id, {
        email: 'idempotent.migration@test.com',
        roles: [
          { role: 'MIGRATION_IDEMP', permissions: MIGRATION_BOOTSTRAP },
        ],
      });
      const token = (await TestHelper.login('idempotent.migration@test.com'))
        .token;

      const ingest = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/file`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          format: 'json',
          content: workshopFixtureContent(),
        })
        .expect(HttpStatus.CREATED);

      const batchId = ingest.body.migrationBatchId;

      await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/${batchId}/validate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.CREATED);

      const first = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/${batchId}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ publishToIga: true })
        .expect(HttpStatus.CREATED);

      expect(first.body.attempted).toBe(1);
      expect(first.body.results[0].success).toBe(true);

      const promotedCount = await TestHelper.getPrisma().hcmContractorStaging.count({
        where: {
          migrationBatchId: batchId,
          validationStatus: HcmStagingValidationStatus.PROMOTED,
        },
      });
      expect(promotedCount).toBe(1);

      const second = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/${batchId}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ publishToIga: true })
        .expect(HttpStatus.CREATED);

      expect(second.body.attempted).toBe(0);
      expect(second.body.results).toHaveLength(0);

      const ctrCount = await TestHelper.getPrisma().contractor.count({
        where: { legacySourcePersonId: 'hcm-ws-active-001' },
      });
      expect(ctrCount).toBe(1);
    });
  });
});
