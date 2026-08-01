import { INestApplication } from '@nestjs/common';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ContractType,
  HcmStagingValidationStatus,
  SupplierType,
} from '@prisma/client';
import { HcmMigrationWorkshopService } from '../src/domain/contractor-migration/services/hcm-migration-workshop.service';
import { TestHelper } from './utils/test-helper';

/**
 * PR-CTR-3 + 2B + 5 — end-to-end migration control plane (staging → validate → promote).
 */
describe('HCM migration pipeline (PR-CTR-3 workshop)', () => {
  let app: INestApplication;
  let workshop: HcmMigrationWorkshopService;

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: join(__dirname, '..'),
      stdio: 'pipe',
    });
    app = await TestHelper.setupTestApp();
    workshop = app.get(HcmMigrationWorkshopService);
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  it('ingests, quarantines invalid rows, and promotes PASSED with CTR-*', async () => {
    const org = await TestHelper.createTestOrganization({ code: 'HCMWS' });
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'hcm-ws-supplier@test.com',
        country: 'ZA',
      },
    });

    await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'HCM-WS-MSA',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Workshop MSA',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
      },
    });

    const fixturePath = join(
      __dirname,
      'fixtures/hcm-extract/workshop-sample.json',
    );
    const content = readFileSync(fixturePath, 'utf8');

    const result = await workshop.runFilePipeline(
      {
        organizationId: org.id,
        format: 'json',
        content,
        fileName: 'workshop-sample.json',
        waveLabel: 'E2E_WORKSHOP',
      },
      { validateAfterIngest: true, promotePassed: true, publishToIga: false },
    );

    expect(result.ingest.inserted).toBe(2);
    expect(result.validation).toHaveLength(2);

    const passed = result.validation.filter(
      (v) => v.validationStatus === HcmStagingValidationStatus.PASSED,
    );
    const quarantined = result.validation.filter(
      (v) => v.validationStatus === HcmStagingValidationStatus.QUARANTINED,
    );
    expect(passed.length).toBe(1);
    expect(quarantined.length).toBe(1);

    expect(result.promotion).toHaveLength(1);
    expect(result.promotion[0].success).toBe(true);
    expect(result.promotion[0].contractorBusinessId).toMatch(/^CTR-HCMWS-/);

    const contractor = await prisma.contractor.findFirst({
      where: { contractorBusinessId: result.promotion[0].contractorBusinessId },
    });
    expect(contractor).toBeTruthy();
    expect(contractor?.legacySourcePersonId).toBe('hcm-ws-active-001');

    const identityMap = await prisma.contractorIdentityMap.findUnique({
      where: {
        contractorBusinessId: result.promotion[0].contractorBusinessId!,
      },
    });
    expect(identityMap?.legacyHcmPersonId).toBe('hcm-ws-active-001');
  });
});
