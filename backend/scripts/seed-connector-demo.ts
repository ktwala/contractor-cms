/**
 * Reset DEMO tenant to an empty connector baseline for Workforce Discovery demos.
 *
 * Default (greenfield MTN sales path): no contractors or suppliers — first discovery shows
 * Matched 0, New/unmatched 40 (MTN fixtures).
 *
 * Migration / conflict UAT: set SEED_HCM_COMPARISON_ANCHORS=true or pass --with-comparison-anchors
 * to seed hidden comparison anchors excluded from registry UIs but included in correlation.
 */
import { loadBackendEnv } from './load-backend-env';

loadBackendEnv();

import {
  EngagementModel,
  MigrationSourceSystem,
  PrismaClient,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import { DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE } from '../src/core/authority/authority.constants';
import {
  COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX,
  COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX,
  COMPARISON_ANCHOR_SUPPLIER_EMAIL,
  COMPARISON_ANCHOR_TAX_NUMBER,
  isComparisonAnchorContractor,
  isComparisonAnchorSupplier,
} from '../src/domain/demo/connector-demo-comparison.constants';

const DEMO_ORG_CODE = 'DEMO';
const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  if (argv.includes('--import')) {
    console.warn('\n⚠️  --import is deprecated. Use mock Oracle REST + UI demo sync.\n');
  }
}

function comparisonAnchorsEnabled(argv: string[]): boolean {
  if (argv.includes('--with-comparison-anchors')) {
    return true;
  }
  const env = process.env.SEED_HCM_COMPARISON_ANCHORS?.trim().toLowerCase();
  return env === 'true' || env === '1' || env === 'yes';
}

async function purgeDemoOrgRegistry(organizationId: string): Promise<void> {
  const supplierIds = (
    await prisma.supplier.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (supplierIds.length === 0) {
    return;
  }

  const contractorIds = (
    await prisma.contractor.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  if (contractorIds.length > 0) {
    const engagementIds = (
      await prisma.contractorEngagement.findMany({
        where: { contractorId: { in: contractorIds } },
        select: { id: true },
      })
    ).map((e) => e.id);

    if (engagementIds.length > 0) {
      await prisma.responsibleManagerAccountabilityTask.deleteMany({
        where: { engagementId: { in: engagementIds } },
      });
    }

    await prisma.timesheet.deleteMany({ where: { contractorId: { in: contractorIds } } });
    await prisma.invoice.deleteMany({ where: { supplierId: { in: supplierIds } } });
    await prisma.contractorEngagement.deleteMany({
      where: { contractorId: { in: contractorIds } },
    });
    await prisma.contractorIdentityMap.deleteMany({
      where: { contractorId: { in: contractorIds } },
    });
    await prisma.user.updateMany({
      where: { contractorId: { in: contractorIds } },
      data: { contractorId: null },
    });
    await prisma.contractor.deleteMany({ where: { id: { in: contractorIds } } });
  }

  await prisma.supplierDocument.deleteMany({ where: { supplierId: { in: supplierIds } } });
  await prisma.supplierMembership.deleteMany({ where: { supplierId: { in: supplierIds } } });
  await prisma.supplierContract.deleteMany({ where: { supplierId: { in: supplierIds } } });
  await prisma.supplier.deleteMany({ where: { organizationId } });
}

async function resetDemoConnectorBaseline(organizationId: string): Promise<void> {
  const remediations = await prisma.contractorGovernanceRemediation.deleteMany({
    where: { organizationId },
  });
  const contractorDrifts = await prisma.contractorSourceDrift.deleteMany({
    where: { organizationId },
  });
  const quarantine = await prisma.hcmContractorQuarantine.deleteMany({
    where: { organizationId },
  });
  const hcmStaging = await prisma.hcmContractorStaging.deleteMany({
    where: { organizationId },
  });
  const hcmSyncRuns = await prisma.contractorSourceSyncRun.deleteMany({
    where: { organizationId },
  });
  const migrationAudit = await prisma.contractorMigrationAudit.deleteMany({
    where: { organizationId },
  });
  const migrationBatches = await prisma.contractorMigrationBatch.deleteMany({
    where: { organizationId },
  });
  const supplierDrifts = await prisma.supplierSourceDrift.deleteMany({
    where: { organizationId },
  });
  const supplierStaging = await prisma.supplierSourceStaging.deleteMany({
    where: { organizationId },
  });
  const supplierSyncRuns = await prisma.supplierSourceSyncRun.deleteMany({
    where: { organizationId },
  });

  await purgeDemoOrgRegistry(organizationId);

  console.log(
    `   Connector cleared: remediations=${remediations.count} drifts=${contractorDrifts.count}+${supplierDrifts.count} ` +
      `staging=${hcmStaging.count}+${supplierStaging.count} syncRuns=${hcmSyncRuns.count}+${supplierSyncRuns.count}`,
  );
}

async function seedHiddenComparisonAnchors(organizationId: string): Promise<string> {
  const anchorSupplier = await prisma.supplier.create({
    data: {
      organizationId,
      type: SupplierType.COMPANY,
      status: SupplierStatus.ACTIVE,
      companyName: `${COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX} Demo Supplier Ltd`,
      tradingName: 'Demo Supplier Ltd',
      email: COMPARISON_ANCHOR_SUPPLIER_EMAIL,
      phone: '+27000000000',
      country: 'ZA',
      countryCode: 'ZA',
      taxNumber: COMPARISON_ANCHOR_TAX_NUMBER,
      sourceSystem: SupplierSourceSystem.CMS_NATIVE,
      sourceSyncStatus: SupplierSourceSyncStatus.NOT_SYNCED,
    },
  });

  const portalUser = await prisma.user.findUnique({
    where: { email: 'supplier.portal@ewp.demo' },
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: 'ops.admin@ewp.demo' },
  });

  if (portalUser) {
    await prisma.supplierMembership.upsert({
      where: {
        userId_supplierId: { userId: portalUser.id, supplierId: anchorSupplier.id },
      },
      update: { isActive: true },
      create: {
        userId: portalUser.id,
        supplierId: anchorSupplier.id,
        role: 'ADMIN',
        assignedBy: adminUser?.id ?? portalUser.id,
      },
    });
  }

  const anchorContractors: Array<{
    email: string;
    firstName: string;
    lastName: string;
    legacySourcePersonId: string;
    isActive: boolean;
  }> = [
    { email: 'anchor.demo.worker.high01@demo.internal', firstName: 'Anchor', lastName: 'High01', legacySourcePersonId: 'HCM-WORKER-DEMO-001', isActive: true },
    { email: 'anchor.demo.worker.high02@demo.internal', firstName: 'Anchor', lastName: 'High02', legacySourcePersonId: 'HCM-WORKER-DEMO-002', isActive: true },
    { email: 'anchor.demo.worker.high03@demo.internal', firstName: 'Anchor', lastName: 'High03', legacySourcePersonId: 'HCM-WORKER-DEMO-003', isActive: true },
    { email: 'anchor.demo.worker.high04@demo.internal', firstName: 'Anchor', lastName: 'High04', legacySourcePersonId: 'HCM-WORKER-DEMO-004', isActive: true },
    { email: 'anchor.demo.worker.low05@demo.internal', firstName: 'Anchor', lastName: 'Low05', legacySourcePersonId: 'legacy-other-HCM-WORKER-DEMO-005', isActive: true },
    { email: 'anchor.demo.worker.low06@demo.internal', firstName: 'Anchor', lastName: 'Low06', legacySourcePersonId: 'legacy-other-HCM-WORKER-DEMO-006', isActive: true },
    { email: 'anchor.demo.worker.conflict07a@demo.internal', firstName: 'Anchor', lastName: '07A', legacySourcePersonId: 'HCM-WORKER-DEMO-007', isActive: true },
    { email: 'anchor.demo.worker.conflict07b@demo.internal', firstName: 'Anchor', lastName: '07B', legacySourcePersonId: 'HCM-WORKER-DEMO-007', isActive: true },
    { email: 'anchor.demo.worker.unsponsored08@demo.internal', firstName: 'Anchor', lastName: 'Unsponsored08', legacySourcePersonId: 'HCM-WORKER-DEMO-008', isActive: true },
    { email: 'anchor.demo.worker.ended10@demo.internal', firstName: 'Anchor', lastName: 'Ended10', legacySourcePersonId: 'HCM-WORKER-DEMO-010', isActive: false },
  ];

  for (const row of anchorContractors) {
    await prisma.contractor.create({
      data: {
        organizationId,
        supplierId: anchorSupplier.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        workerClassification: 'SUPPLIER_CONTRACTOR',
        engagementModel: EngagementModel.DIRECT,
        taxResidency: 'ZA',
        isActive: row.isActive,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: row.legacySourcePersonId,
      },
    });
  }

  console.log(
    `   ✓ Hidden comparison anchors: 1 supplier + ${anchorContractors.length} contractors (excluded from registry UIs)`,
  );

  return anchorSupplier.id;
}

async function resetOrgConnectorCheckpoints(organizationId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      supplierAuthorityMode: 'ORACLE_ONLY',
      contractorAuthorityMode: DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE,
      hcmType: 'ORACLE_HCM',
      oracleSupplierConnectorHealth: 'UNKNOWN',
      oracleSupplierLastSuccessfulSyncAt: null,
      oracleSupplierLastCursor: null,
      oracleSupplierConnectorLastError: null,
      oracleHcmConnectorHealth: 'UNKNOWN',
      oracleHcmLastSuccessfulSyncAt: null,
      oracleHcmLastCursor: null,
      oracleHcmConnectorLastError: null,
    },
  });
}

async function assertEmptyBaseline(organizationId: string): Promise<void> {
  const counts = {
    supplierSyncRuns: await prisma.supplierSourceSyncRun.count({ where: { organizationId } }),
    supplierStaging: await prisma.supplierSourceStaging.count({ where: { organizationId } }),
    supplierDrifts: await prisma.supplierSourceDrift.count({ where: { organizationId } }),
    hcmSyncRuns: await prisma.contractorSourceSyncRun.count({ where: { organizationId } }),
    hcmStaging: await prisma.hcmContractorStaging.count({ where: { organizationId } }),
    contractorDrifts: await prisma.contractorSourceDrift.count({ where: { organizationId } }),
    remediations: await prisma.contractorGovernanceRemediation.count({ where: { organizationId } }),
  };

  const bad = Object.entries(counts).filter(([, n]) => n > 0);
  if (bad.length > 0) {
    throw new Error(`Connector baseline not empty: ${bad.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
}

async function assertRegistryBaseline(
  organizationId: string,
  withComparisonAnchors: boolean,
): Promise<void> {
  const suppliers = await prisma.supplier.findMany({ where: { organizationId } });
  const visibleSuppliers = suppliers.filter((s) => !isComparisonAnchorSupplier(s));

  const contractors = await prisma.contractor.findMany({
    where: { supplier: { organizationId } },
    select: { email: true },
  });
  const visibleContractors = contractors.filter((c) => !isComparisonAnchorContractor(c));
  const anchorContractors = contractors.filter((c) => isComparisonAnchorContractor(c));

  if (visibleSuppliers.length > 0 || visibleContractors.length > 0) {
    throw new Error(
      `Visible registry not empty: suppliers=${visibleSuppliers.length} contractors=${visibleContractors.length}`,
    );
  }

  if (withComparisonAnchors) {
    if (anchorContractors.length === 0) {
      throw new Error('Comparison anchors expected but none were seeded');
    }
    console.log(
      `   ✓ Greenfield visible registry empty (${anchorContractors.length} hidden comparison anchors for migration UAT)`,
    );
    return;
  }

  if (suppliers.length > 0 || contractors.length > 0) {
    throw new Error(
      `Greenfield baseline not empty: suppliers=${suppliers.length} contractors=${contractors.length}`,
    );
  }

  console.log('   ✓ Greenfield registry empty (no suppliers or contractors)');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  parseArgs(argv);
  const withComparisonAnchors = comparisonAnchorsEnabled(argv);

  const org = await prisma.organization.findUnique({ where: { code: DEMO_ORG_CODE } });
  if (!org) {
    throw new Error(`Organization ${DEMO_ORG_CODE} not found. Run: npm run db:seed`);
  }

  console.log(
    `🔄 Resetting DEMO tenant (org ${org.id}) — ${
      withComparisonAnchors
        ? 'migration/conflict demo (hidden comparison anchors)'
        : 'greenfield demo (no pre-seeded workers)'
    }…`,
  );
  await resetDemoConnectorBaseline(org.id);
  await resetOrgConnectorCheckpoints(org.id);
  if (withComparisonAnchors) {
    await seedHiddenComparisonAnchors(org.id);
  }
  await assertEmptyBaseline(org.id);
  await assertRegistryBaseline(org.id, withComparisonAnchors);

  console.log('\n✅ Reset complete.');
  console.log('   Suppliers & contractors pages: empty.');
  console.log('   Connector ops: empty until Sync demo buttons.');
  if (withComparisonAnchors) {
    console.log(
      '   First HCM discovery: expect Matched 6, No worker match 3, Conflict 1 (migration UAT only).',
    );
    console.log('   Re-run without SEED_HCM_COMPARISON_ANCHORS for the default MTN greenfield path.');
  } else {
    console.log('   Prep: docker compose restart mock-oracle  (if mock was up before MTN fixture change)');
    console.log('   Run order: docs/DEMO-MTN-STORY.md');
    console.log('   Supplier sync → SYNC-00001 = 5 · Workforce discovery → DISC-00001 = 40');
    console.log(
      '   Migration/conflict UAT: SEED_HCM_COMPARISON_ANCHORS=true npm run reset:connector-demo',
    );
  }
}

main()
  .catch((err) => {
    console.error('❌ reset:connector-demo failed:', err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
