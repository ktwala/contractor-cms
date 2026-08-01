/**
 * Deterministic named governance demo fixtures (UAT / demos).
 * @see governance-demo-fixtures.constants.ts
 */
import {
  ContractorGovernanceRemediationStatus,
  ContractorGovernanceRemediationType,
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
  ContractorSourceSyncRunMode,
  ContractorSourceSyncRunStatus,
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  HcmOracleConnectorHealth,
  MigrationSourceSystem,
  OracleSupplierConnectorHealth,
  PrismaClient,
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncRunMode,
  SupplierSourceSyncRunStatus,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import { buildContractorDriftFingerprint } from '../src/domain/contractor-sources/contractor-source-drift.util';
import { buildDriftFingerprint } from '../src/domain/supplier-sources/supplier-source-drift.util';
import {
  SUPPLIER_GOVERNANCE_FIXTURES,
  WORKFORCE_GOVERNANCE_FIXTURES,
} from './governance-demo-fixtures.constants';

export type GovernanceSeedContext = {
  organizationId: string;
  demoSupplierId: string;
  governanceOpsUserId: string;
  governanceReviewerUserId: string;
};

const LEGACY_SUPPLIER_EXTERNAL_IDS = [
  'GOV-ORACLE-PENDING-004',
] as const;

const LEGACY_HCM_PERSON_IDS = [
  'GOV-HCM-HIGH-001',
  'GOV-HCM-LOW-002',
  'GOV-HCM-MANUAL-003',
  'GOV-HCM-FLAGSHIP-004',
  'GOV-HCM-NOLINK-005',
] as const;

async function cleanupLegacyFixtureKeys(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  await prisma.contractorGovernanceRemediation.deleteMany({
    where: { organizationId, drift: { sourcePersonId: { in: [...LEGACY_HCM_PERSON_IDS] } } },
  });
  await prisma.contractorSourceDrift.deleteMany({
    where: { organizationId, sourcePersonId: { in: [...LEGACY_HCM_PERSON_IDS] } },
  });
  await prisma.hcmContractorStaging.deleteMany({
    where: { organizationId, sourcePersonId: { in: [...LEGACY_HCM_PERSON_IDS] } },
  });
  await prisma.supplierSourceDrift.deleteMany({
    where: {
      organizationId,
      externalSupplierId: { in: [...LEGACY_SUPPLIER_EXTERNAL_IDS] },
    },
  });
}

export async function seedGovernanceFixtures(
  prisma: PrismaClient,
  ctx: GovernanceSeedContext,
): Promise<void> {
  const { organizationId, demoSupplierId, governanceOpsUserId, governanceReviewerUserId } =
    ctx;

  await cleanupLegacyFixtureKeys(prisma, organizationId);

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const F = SUPPLIER_GOVERNANCE_FIXTURES;
  const H = WORKFORCE_GOVERNANCE_FIXTURES;

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      hcmType: 'ORACLE_HCM',
      supplierAuthorityMode: 'ORACLE_ONLY',
      contractorAuthorityMode: 'HYBRID',
      oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.STALE,
      oracleSupplierLastSuccessfulSyncAt: hoursAgo(52),
      oracleHcmConnectorHealth: HcmOracleConnectorHealth.HEALTHY,
      oracleHcmLastSuccessfulSyncAt: hoursAgo(1),
    },
  });

  const supplierSyncOk = await prisma.supplierSourceSyncRun.upsert({
    where: { id: `gov-seed-supplier-sync-${organizationId}` },
    update: {
      status: SupplierSourceSyncRunStatus.SUCCEEDED,
      finishedAt: hoursAgo(2),
      importedCount: 12,
      matchedCount: 8,
      newCount: 2,
    },
    create: {
      id: `gov-seed-supplier-sync-${organizationId}`,
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      status: SupplierSourceSyncRunStatus.SUCCEEDED,
      mode: SupplierSourceSyncRunMode.INCREMENTAL,
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2),
      requestedByUserId: governanceOpsUserId,
      importedCount: 12,
      matchedCount: 8,
      newCount: 2,
    },
  });

  await prisma.supplierSourceStaging.upsert({
    where: {
      organizationId_sourceSystem_externalSupplierId: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: F.HEALTHY_MATCHED,
      },
    },
    update: {
      matchStatus: SupplierSourceStagingMatchStatus.MATCHED,
      proposedSupplierId: demoSupplierId,
    },
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.HEALTHY_MATCHED,
      supplierNumber: 'SUP-HEALTHY',
      name: 'Demo Supplier Ltd',
      countryCode: 'ZA',
      rawPayload: { fixture: F.HEALTHY_MATCHED, status: 'ACTIVE' },
      matchStatus: SupplierSourceStagingMatchStatus.MATCHED,
      matchReason: 'Linked to governance twin',
      proposedSupplierId: demoSupplierId,
    },
  });

  await prisma.supplierSourceStaging.upsert({
    where: {
      organizationId_sourceSystem_externalSupplierId: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: F.POSSIBLE_MATCH,
      },
    },
    update: { matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH },
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.POSSIBLE_MATCH,
      supplierNumber: 'SUP-POSSIBLE',
      name: 'Possible Match Vendor',
      countryCode: 'ZA',
      rawPayload: { fixture: F.POSSIBLE_MATCH },
      matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
      matchReason: 'Fuzzy name match — governance review required',
    },
  });

  const reconStaging = await prisma.supplierSourceStaging.upsert({
    where: {
      organizationId_sourceSystem_externalSupplierId: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: F.RECONCILIATION_CONFLICT,
      },
    },
    update: { matchStatus: SupplierSourceStagingMatchStatus.CONFLICT },
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.RECONCILIATION_CONFLICT,
      supplierNumber: 'SUP-RECON',
      name: 'Reconciliation Conflict Vendor',
      countryCode: 'ZA',
      rawPayload: { fixture: F.RECONCILIATION_CONFLICT },
      matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
      matchReason: 'Multiple CMS candidates — manual reconciliation required',
    },
  });

  const reconFp = buildDriftFingerprint({
    organizationId,
    driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
    stagingId: reconStaging.id,
    externalSupplierId: F.RECONCILIATION_CONFLICT,
  });
  await prisma.supplierSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: reconFp },
    },
    update: { status: SupplierSourceDriftStatus.UNDER_REVIEW },
    create: {
      organizationId,
      stagingId: reconStaging.id,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.RECONCILIATION_CONFLICT,
      driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
      severity: SupplierSourceDriftSeverity.HIGH,
      status: SupplierSourceDriftStatus.UNDER_REVIEW,
      driftFingerprint: reconFp,
      assignedToUserId: governanceReviewerUserId,
      sourceSnapshot: { fixture: F.RECONCILIATION_CONFLICT },
    },
  });

  const pendingSupplier =
    (await prisma.supplier.findFirst({
      where: { organizationId, email: 'fixture.oracle-pending@demo.com' },
    })) ??
    (await prisma.supplier.create({
      data: {
        organizationId,
        type: SupplierType.COMPANY,
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Fixture Pending Evidence Vendor',
        email: 'fixture.oracle-pending@demo.com',
        country: 'ZA',
      },
    }));

  await prisma.supplierSourceStaging.upsert({
    where: {
      organizationId_sourceSystem_externalSupplierId: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: F.PENDING_EVIDENCE,
      },
    },
    update: { proposedSupplierId: pendingSupplier.id },
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.PENDING_EVIDENCE,
      supplierNumber: 'SUP-PENDING',
      name: 'Fixture Pending Evidence Vendor',
      countryCode: 'ZA',
      rawPayload: { fixture: F.PENDING_EVIDENCE },
      matchStatus: SupplierSourceStagingMatchStatus.MATCHED,
      proposedSupplierId: pendingSupplier.id,
    },
  });

  const dupFp = buildDriftFingerprint({
    organizationId,
    driftType: SupplierSourceDriftType.DUPLICATE_EXTERNAL_ID,
    externalSupplierId: F.DUPLICATE_EXTERNAL,
  });
  await prisma.supplierSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: dupFp },
    },
    update: {
      status: SupplierSourceDriftStatus.CLASSIFIED,
      assignedToUserId: governanceReviewerUserId,
    },
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.DUPLICATE_EXTERNAL,
      driftType: SupplierSourceDriftType.DUPLICATE_EXTERNAL_ID,
      severity: SupplierSourceDriftSeverity.HIGH,
      status: SupplierSourceDriftStatus.CLASSIFIED,
      driftFingerprint: dupFp,
      assignedToUserId: governanceReviewerUserId,
      governanceSnapshot: { fixture: F.DUPLICATE_EXTERNAL },
    },
  });

  const pendingFp = buildDriftFingerprint({
    organizationId,
    driftType: SupplierSourceDriftType.GOVERNANCE_STATE_CONFLICT,
    supplierId: pendingSupplier.id,
    externalSupplierId: F.PENDING_EVIDENCE,
  });
  await prisma.supplierSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: pendingFp },
    },
    update: { status: SupplierSourceDriftStatus.UNDER_REVIEW },
    create: {
      organizationId,
      supplierId: pendingSupplier.id,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.PENDING_EVIDENCE,
      driftType: SupplierSourceDriftType.GOVERNANCE_STATE_CONFLICT,
      severity: SupplierSourceDriftSeverity.CRITICAL,
      status: SupplierSourceDriftStatus.UNDER_REVIEW,
      driftFingerprint: pendingFp,
      assignedToUserId: governanceReviewerUserId,
      governanceSnapshot: { fixture: F.PENDING_EVIDENCE },
    },
  });

  await prisma.supplierSourceSyncRun.upsert({
    where: { id: `gov-seed-supplier-sync-stale-${organizationId}` },
    update: {
      status: SupplierSourceSyncRunStatus.FAILED,
      errorMessage: 'Oracle rate limit — checkpoint gap (fixture)',
    },
    create: {
      id: `gov-seed-supplier-sync-stale-${organizationId}`,
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      status: SupplierSourceSyncRunStatus.FAILED,
      mode: SupplierSourceSyncRunMode.INCREMENTAL,
      startedAt: hoursAgo(48),
      finishedAt: hoursAgo(47),
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Oracle rate limit — checkpoint gap (fixture)',
    },
  });

  await prisma.supplierSourceStaging.upsert({
    where: {
      organizationId_sourceSystem_externalSupplierId: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: F.STALE_CONNECTOR,
      },
    },
    update: {},
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.STALE_CONNECTOR,
      supplierNumber: 'SUP-STALE',
      name: 'Stale Connector Fixture Row',
      countryCode: 'ZA',
      rawPayload: { fixture: F.STALE_CONNECTOR },
      matchStatus: SupplierSourceStagingMatchStatus.NEW,
    },
  });

  const staleFp = buildDriftFingerprint({
    organizationId,
    driftType: SupplierSourceDriftType.CHECKPOINT_GAP,
    externalSupplierId: F.STALE_CONNECTOR,
  });
  await prisma.supplierSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: staleFp },
    },
    update: {},
    create: {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: F.STALE_CONNECTOR,
      driftType: SupplierSourceDriftType.CHECKPOINT_GAP,
      severity: SupplierSourceDriftSeverity.HIGH,
      status: SupplierSourceDriftStatus.DETECTED,
      driftFingerprint: staleFp,
      governanceSnapshot: { fixture: F.STALE_CONNECTOR, lastSyncRunId: supplierSyncOk.id },
    },
  });

  const hcmSyncRun = await prisma.contractorSourceSyncRun.upsert({
    where: { id: `gov-seed-hcm-sync-${organizationId}` },
    update: {
      status: ContractorSourceSyncRunStatus.SUCCEEDED,
      finishedAt: hoursAgo(1),
      importedCount: 6,
      matchedCount: 4,
      correlationFailures: 1,
    },
    create: {
      id: `gov-seed-hcm-sync-${organizationId}`,
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      status: ContractorSourceSyncRunStatus.SUCCEEDED,
      mode: ContractorSourceSyncRunMode.INCREMENTAL,
      startedAt: hoursAgo(2),
      finishedAt: hoursAgo(1),
      requestedByUserId: governanceOpsUserId,
      importedCount: 6,
      matchedCount: 4,
      correlationFailures: 1,
    },
  });

  const upsertContractor = async (input: {
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    legacySourcePersonId: string;
  }) => {
    const existing = await prisma.contractor.findFirst({
      where: { supplierId: demoSupplierId, email: input.email },
    });
    if (existing) {
      return prisma.contractor.update({
        where: { id: existing.id },
        data: {
          isActive: input.isActive,
          legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
          legacySourcePersonId: input.legacySourcePersonId,
        },
      });
    }
    return prisma.contractor.create({
      data: {
        organizationId,
        supplierId: demoSupplierId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        workerClassification: 'SUPPLIER_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
        isActive: input.isActive,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: input.legacySourcePersonId,
      },
    });
  };

  const highCorr = await upsertContractor({
    email: 'fixture.hcm-highconf@demo.local',
    firstName: 'High',
    lastName: 'Confidence',
    isActive: true,
    legacySourcePersonId: H.HIGH_CONFIDENCE,
  });
  await prisma.hcmContractorStaging.upsert({
    where: {
      organizationId_sourceSystem_sourcePersonId: {
        organizationId,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        sourcePersonId: H.HIGH_CONFIDENCE,
      },
    },
    update: {
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
      correlationConfidence: HcmContractorCorrelationConfidence.HIGH,
      proposedContractorId: highCorr.id,
    },
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.HIGH_CONFIDENCE,
      sourcePayloadJson: { fixture: H.HIGH_CONFIDENCE },
      sourceHash: 'fixture-hash-high',
      normalizedPayloadJson: {
        sourcePersonId: H.HIGH_CONFIDENCE,
        assignmentStatus: 'active',
        workerType: 'CWK',
      },
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
      correlationConfidence: HcmContractorCorrelationConfidence.HIGH,
      proposedContractorId: highCorr.id,
      contractorSourceSyncRunId: hcmSyncRun.id,
    },
  });

  const lowCorr = await upsertContractor({
    email: 'fixture.hcm-lowconf@demo.local',
    firstName: 'Low',
    lastName: 'Confidence',
    isActive: true,
    legacySourcePersonId: H.LOW_CONFIDENCE,
  });
  await prisma.hcmContractorStaging.upsert({
    where: {
      organizationId_sourceSystem_sourcePersonId: {
        organizationId,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        sourcePersonId: H.LOW_CONFIDENCE,
      },
    },
    update: {
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
      correlationConfidence: HcmContractorCorrelationConfidence.LOW,
      proposedContractorId: lowCorr.id,
    },
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.LOW_CONFIDENCE,
      sourcePayloadJson: { fixture: H.LOW_CONFIDENCE },
      sourceHash: 'fixture-hash-low',
      normalizedPayloadJson: { assignmentStatus: 'active', fixture: H.LOW_CONFIDENCE },
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
      correlationConfidence: HcmContractorCorrelationConfidence.LOW,
      proposedContractorId: lowCorr.id,
      contractorSourceSyncRunId: hcmSyncRun.id,
    },
  });

  await prisma.hcmContractorStaging.upsert({
    where: {
      organizationId_sourceSystem_sourcePersonId: {
        organizationId,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        sourcePersonId: H.IDENTITY_CONFLICT,
      },
    },
    update: {
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
      correlationConfidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
    },
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.IDENTITY_CONFLICT,
      sourcePayloadJson: { fixture: H.IDENTITY_CONFLICT },
      sourceHash: 'fixture-hash-conflict',
      normalizedPayloadJson: { assignmentStatus: 'active', fixture: H.IDENTITY_CONFLICT },
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
      correlationConfidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
      contractorSourceSyncRunId: hcmSyncRun.id,
    },
  });

  const conflictFp = buildContractorDriftFingerprint({
    organizationId,
    driftType: ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
    sourcePersonId: H.IDENTITY_CONFLICT,
  });
  await prisma.contractorSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: conflictFp },
    },
    update: { status: ContractorSourceDriftStatus.UNDER_REVIEW },
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.IDENTITY_CONFLICT,
      driftType: ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
      severity: ContractorSourceDriftSeverity.HIGH,
      status: ContractorSourceDriftStatus.UNDER_REVIEW,
      driftFingerprint: conflictFp,
      assignedToUserId: governanceReviewerUserId,
      governanceSnapshot: { fixture: H.IDENTITY_CONFLICT },
    },
  });

  const flagship = await upsertContractor({
    email: 'fixture.hcm-term-active@demo.local',
    firstName: 'Terminated',
    lastName: 'ButActive',
    isActive: true,
    legacySourcePersonId: H.TERM_ACTIVE,
  });
  const flagshipStaging = await prisma.hcmContractorStaging.upsert({
    where: {
      organizationId_sourceSystem_sourcePersonId: {
        organizationId,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        sourcePersonId: H.TERM_ACTIVE,
      },
    },
    update: {
      normalizedPayloadJson: {
        sourcePersonId: H.TERM_ACTIVE,
        assignmentStatus: 'terminated',
        workerType: 'CWK',
        fixture: H.TERM_ACTIVE,
      },
      proposedContractorId: flagship.id,
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
      correlationConfidence: HcmContractorCorrelationConfidence.HIGH,
    },
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.TERM_ACTIVE,
      sourcePayloadJson: { status: 'terminated', fixture: H.TERM_ACTIVE },
      sourceHash: 'fixture-hash-term-active',
      normalizedPayloadJson: {
        sourcePersonId: H.TERM_ACTIVE,
        assignmentStatus: 'terminated',
        workerType: 'CWK',
        fixture: H.TERM_ACTIVE,
      },
      proposedContractorId: flagship.id,
      correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
      correlationConfidence: HcmContractorCorrelationConfidence.HIGH,
      contractorSourceSyncRunId: hcmSyncRun.id,
    },
  });

  const lifecycleFp = buildContractorDriftFingerprint({
    organizationId,
    driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
    contractorId: flagship.id,
    sourcePersonId: H.TERM_ACTIVE,
    stagingId: flagshipStaging.id,
  });
  const lifecycleDrift = await prisma.contractorSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: lifecycleFp },
    },
    update: {
      status: ContractorSourceDriftStatus.CLASSIFIED,
      contractorId: flagship.id,
      stagingId: flagshipStaging.id,
    },
    create: {
      organizationId,
      contractorId: flagship.id,
      stagingId: flagshipStaging.id,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.TERM_ACTIVE,
      driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
      severity: ContractorSourceDriftSeverity.CRITICAL,
      status: ContractorSourceDriftStatus.CLASSIFIED,
      driftFingerprint: lifecycleFp,
      detectedByRunId: hcmSyncRun.id,
      governanceSnapshot: {
        fixture: H.TERM_ACTIVE,
        terminatedUpstream: true,
        cmsActive: true,
      },
    },
  });

  await prisma.contractorGovernanceRemediation.upsert({
    where: { driftId: lifecycleDrift.id },
    update: {
      pdpRestrictionsApplied: true,
      remediationStatus: ContractorGovernanceRemediationStatus.OPEN,
      assignedToUserId: governanceReviewerUserId,
    },
    create: {
      organizationId,
      driftId: lifecycleDrift.id,
      contractorId: flagship.id,
      remediationType: ContractorGovernanceRemediationType.PDP_RESTRICTION,
      remediationStatus: ContractorGovernanceRemediationStatus.OPEN,
      assignedToUserId: governanceReviewerUserId,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      escalationLevel: 1,
      pdpRestrictionsApplied: true,
      downstreamActions: ['ACCESS_REVIEW_REQUIRED', 'TERMINATION_VALIDATION'],
      auditTrail: [
        {
          at: now.toISOString(),
          action: 'REMEDIATION_CREATED',
          fixture: H.TERM_ACTIVE,
        },
      ],
    },
  });

  const noLinkFp = buildContractorDriftFingerprint({
    organizationId,
    driftType: ContractorSourceDriftType.SUPPLIER_LINK_MISSING,
    sourcePersonId: H.NO_SUPPLIER_LINK,
  });
  await prisma.contractorSourceDrift.upsert({
    where: {
      organizationId_driftFingerprint: { organizationId, driftFingerprint: noLinkFp },
    },
    update: {},
    create: {
      organizationId,
      sourceSystem: MigrationSourceSystem.ORACLE_HCM,
      sourcePersonId: H.NO_SUPPLIER_LINK,
      driftType: ContractorSourceDriftType.SUPPLIER_LINK_MISSING,
      severity: ContractorSourceDriftSeverity.HIGH,
      status: ContractorSourceDriftStatus.DETECTED,
      driftFingerprint: noLinkFp,
      governanceSnapshot: { fixture: H.NO_SUPPLIER_LINK },
    },
  });

  console.log(
    '✅ Named governance fixtures seeded — open docs/GOVERNANCE_DEMO_FIXTURES.md for UAT script IDs',
  );
}
