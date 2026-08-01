import { INestApplication, HttpStatus } from '@nestjs/common';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ContractType,
  HcmStagingValidationStatus,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import { CONTRACTOR_MIGRATED_EVENT_TYPE } from '../src/domain/contractor-migration/types/contractor-migrated-iga-event.types';
import { TestHelper } from './utils/test-helper';

const ADMIN_BASE = '/admin/contractor-migration';
const MIGRATION_BOOTSTRAP = [
  'contractor-migration:read',
  'contractors:bootstrap',
];
const MIGRATION_READ = ['contractor-migration:read'];
const ORACLE_PERSON_ID = 'hcm-rest-e2e-001';

function oracleWorkersPageBody(): string {
  return readFileSync(
    join(__dirname, 'fixtures/hcm-extract/oracle-rest-workers-page.json'),
    'utf8',
  );
}

function enableOracleRestEnv() {
  process.env.HCM_ORACLE_REST_ENABLED = 'true';
  process.env.HCM_ORACLE_REST_BASE_URL = 'https://mock-hcm.test';
  process.env.HCM_ORACLE_REST_USERNAME = 'integration';
  process.env.HCM_ORACLE_REST_PASSWORD = 'secret';
  process.env.HCM_ORACLE_REST_WORKERS_PATH = '/workers';
}

function disableOracleRestEnv() {
  delete process.env.HCM_ORACLE_REST_ENABLED;
  delete process.env.HCM_ORACLE_REST_BASE_URL;
  delete process.env.HCM_ORACLE_REST_USERNAME;
  delete process.env.HCM_ORACLE_REST_PASSWORD;
  delete process.env.HCM_ORACLE_REST_WORKERS_PATH;
  delete process.env.HCM_ORACLE_REST_BEARER_TOKEN;
  delete process.env.HCM_ORACLE_REST_PAGE_LIMIT;
}

async function seedWorkshopTenant(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  const supplier = await prisma.supplier.create({
    data: {
      organizationId,
      type: SupplierType.COMPANY,
      status: 'ACTIVE',
      companyName: 'Demo Supplier Ltd',
      email: `oracle-ws-supplier-${Date.now()}@test.com`,
      country: 'ZA',
    },
  });

  await prisma.supplierContract.create({
    data: {
      organizationId,
      supplierId: supplier.id,
      contractNumber: `ORACLE-MSA-${Date.now()}`,
      contractType: ContractType.TIME_AND_MATERIALS,
      title: 'Oracle REST E2E MSA',
      startDate: new Date('2024-01-01'),
      status: 'ACTIVE',
    },
  });
}

async function countOrgContractors(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  return prisma.contractor.count({
    where: { supplier: { organizationId } },
  });
}

async function countOrgIdentityMaps(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  return prisma.contractorIdentityMap.count({
    where: { contractor: { supplier: { organizationId } } },
  });
}

async function countOrgMigratedIgaEvents(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  return prisma.igaOutboxEvent.count({
    where: { organizationId, eventType: CONTRACTOR_MIGRATED_EVENT_TYPE },
  });
}

async function getCtrSequenceNext(organizationId: string) {
  const prisma = TestHelper.getPrisma();
  const row = await prisma.ctrSequenceRegistry.findUnique({
    where: { organizationId },
  });
  return row?.nextValue ?? null;
}

/**
 * PR-CTR-4B — Oracle REST admin ingest is staging-only; validate and promote are separate.
 */
describe('Contractor migration Oracle REST admin API (PR-CTR-4B)', () => {
  describe('provider disabled', () => {
    let app: INestApplication;
    const originalFetch = global.fetch;

    beforeAll(async () => {
      disableOracleRestEnv();
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
      global.fetch = originalFetch;
      await TestHelper.cleanupDatabase();
      await TestHelper.closeApp();
    });

    it('returns 503 when Oracle REST extract is disabled', async () => {
      const org = await TestHelper.createTestOrganization({ code: 'ORCDIS' });
      await seedWorkshopTenant(org.id);

      await TestHelper.createUserWithRoles(org.id, {
        email: 'oracle.disabled@test.com',
        roles: [{ role: 'MIGRATION_ORACLE', permissions: MIGRATION_BOOTSTRAP }],
      });
      const token = (await TestHelper.login('oracle.disabled@test.com')).token;

      const response = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/oracle-rest`)
        .set('Authorization', `Bearer ${token}`)
        .send({ waveLabel: 'ORACLE_DISABLED' });

      expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('provider enabled with mocked Oracle REST', () => {
    let app: INestApplication;
    let organizationId: string;
    let token: string;
    const originalFetch = global.fetch;

    beforeAll(async () => {
      enableOracleRestEnv();
      app = await TestHelper.setupTestApp();
    });

    beforeEach(async () => {
      await TestHelper.cleanupDatabase();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => oracleWorkersPageBody(),
      });

      const org = await TestHelper.createTestOrganization({ code: 'ORCREST' });
      organizationId = org.id;
      await seedWorkshopTenant(organizationId);

      await TestHelper.createUserWithRoles(organizationId, {
        email: 'oracle.manage@test.com',
        roles: [{ role: 'MIGRATION_ORACLE', permissions: MIGRATION_BOOTSTRAP }],
      });
      await TestHelper.createUserWithRoles(organizationId, {
        email: 'oracle.read@test.com',
        roles: [{ role: 'MIGRATION_ORACLE_READ', permissions: MIGRATION_READ }],
      });

      token = (await TestHelper.login('oracle.manage@test.com')).token;
    });

    afterAll(async () => {
      global.fetch = originalFetch;
      disableOracleRestEnv();
      await TestHelper.cleanupDatabase();
      await TestHelper.closeApp();
    });

    it('requires contractors:bootstrap for Oracle REST ingest', async () => {
      const readToken = (await TestHelper.login('oracle.read@test.com')).token;

      await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/oracle-rest`)
        .set('Authorization', `Bearer ${readToken}`)
        .send({ waveLabel: 'ORACLE_FORBIDDEN' })
        .expect(403);
    });

    it('ingests mocked workers to staging only, then validate and promote separately', async () => {
      const prisma = TestHelper.getPrisma();
      const server = app.getHttpServer();

      const contractorsBefore = await countOrgContractors(organizationId);
      const identityMapsBefore = await countOrgIdentityMaps(organizationId);
      const igaBefore = await countOrgMigratedIgaEvents(organizationId);
      const ctrNextBefore = await getCtrSequenceNext(organizationId);

      const ingest = await request(server)
        .post(`${ADMIN_BASE}/batches/oracle-rest`)
        .set('Authorization', `Bearer ${token}`)
        .send({ waveLabel: 'ORACLE_REST_E2E' })
        .expect(HttpStatus.CREATED);

      expect(ingest.body.extractMode).toBe('ORACLE_REST');
      expect(ingest.body.inserted).toBe(1);
      const batchId = ingest.body.migrationBatchId;

      expect(global.fetch).toHaveBeenCalled();
      expect(await countOrgContractors(organizationId)).toBe(contractorsBefore);
      expect(await countOrgIdentityMaps(organizationId)).toBe(identityMapsBefore);
      expect(await countOrgMigratedIgaEvents(organizationId)).toBe(igaBefore);
      expect(await getCtrSequenceNext(organizationId)).toBe(ctrNextBefore);

      const stagingRow = await prisma.hcmContractorStaging.findFirst({
        where: {
          migrationBatchId: batchId,
          sourcePersonId: ORACLE_PERSON_ID,
        },
      });
      expect(stagingRow).toBeTruthy();
      expect(stagingRow?.validationStatus).toBe(HcmStagingValidationStatus.PENDING);

      const validate = await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/validate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(HttpStatus.CREATED);

      expect(validate.body.results[0].validationStatus).toBe(
        HcmStagingValidationStatus.PASSED,
      );
      expect(await countOrgContractors(organizationId)).toBe(contractorsBefore);

      const promote = await request(server)
        .post(`${ADMIN_BASE}/batches/${batchId}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ publishToIga: true })
        .expect(HttpStatus.CREATED);

      expect(promote.body.attempted).toBe(1);
      expect(promote.body.results[0].success).toBe(true);
      expect(promote.body.results[0].contractorBusinessId).toMatch(/^CTR-ORCREST-/);

      expect(await countOrgContractors(organizationId)).toBe(contractorsBefore + 1);

      const identityMap = await prisma.contractorIdentityMap.findFirst({
        where: { legacyHcmPersonId: ORACLE_PERSON_ID },
      });
      expect(identityMap).toBeTruthy();

      const igaEvent = await prisma.igaOutboxEvent.findFirst({
        where: {
          organizationId,
          eventType: CONTRACTOR_MIGRATED_EVENT_TYPE,
        },
      });
      expect(igaEvent).toBeTruthy();
      const payload = igaEvent!.payloadJson as Record<string, unknown>;
      expect(payload.legacyHcmPersonId).toBe(ORACLE_PERSON_ID);
    });

    it('returns 400 when enabled but base URL is missing', async () => {
      await TestHelper.closeApp();
      process.env.HCM_ORACLE_REST_BASE_URL = '';
      app = await TestHelper.setupTestApp();

      const org = await TestHelper.createTestOrganization({ code: 'ORC400' });
      await seedWorkshopTenant(org.id);
      await TestHelper.createUserWithRoles(org.id, {
        email: 'oracle.nobase@test.com',
        roles: [{ role: 'MIGRATION_ORACLE', permissions: MIGRATION_BOOTSTRAP }],
      });
      const localToken = (await TestHelper.login('oracle.nobase@test.com')).token;

      const response = await request(app.getHttpServer())
        .post(`${ADMIN_BASE}/batches/oracle-rest`)
        .set('Authorization', `Bearer ${localToken}`)
        .send({ waveLabel: 'NO_BASE_URL' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);

      process.env.HCM_ORACLE_REST_BASE_URL = 'https://mock-hcm.test';
      await TestHelper.closeApp();
      app = await TestHelper.setupTestApp();
    });
  });
});
