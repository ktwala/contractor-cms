-- PR-CTR-2A — HCM migration control plane (staging, quarantine, identity map, audit, CTR sequence)
-- PR-DB-MIGRATION-REPAIR: idempotent DDL for deploy after db push / partial apply

DO $$ BEGIN CREATE TYPE "MigrationSourceSystem" AS ENUM ('ORACLE_HCM', 'CMS_NATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HcmStagingRecordAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'SNAPSHOT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HcmStagingValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'QUARANTINED', 'PROMOTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HcmMigrationPipelineStatus" AS ENUM ('EXTRACTED', 'NORMALIZED', 'VALIDATED', 'QUARANTINED', 'APPROVED', 'CTR_ISSUED', 'PROMOTED', 'IGA_PUBLISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HcmResponsibleManagerValidationStatus" AS ENUM ('VALID', 'MISSING', 'INACTIVE', 'UNKNOWN', 'MISMATCH', 'MULTIPLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractorMigrationStatus" AS ENUM ('NOT_MIGRATED', 'IN_STAGING', 'PROMOTED', 'CMS_NATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractorCanonicalizationStatus" AS ENUM ('PENDING', 'CANONICAL', 'OVERRIDE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractorIdentityMapStatus" AS ENUM ('ACTIVE', 'RETIRED', 'SUPERSEDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HcmQuarantineReasonCode" AS ENUM ('DUPLICATE_IDENTITY', 'MISSING_RESPONSIBLE_MANAGER', 'INACTIVE_RESPONSIBLE_MANAGER', 'INVALID_DATES', 'OVERLAPPING_ENGAGEMENT', 'WORKER_TYPE_MISMATCH', 'EMPLOYEE_COLLISION', 'SUPPLIER_UNRESOLVED', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractorMigrationAuditAction" AS ENUM ('BATCH_STARTED', 'EXTRACTED', 'NORMALIZED', 'VALIDATED', 'QUARANTINED', 'APPROVED', 'CTR_ISSUED', 'PROMOTED', 'IGA_PUBLISHED', 'OVERRIDE_APPLIED', 'BATCH_COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContractorMigrationBatchStatus" AS ENUM ('OPEN', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ContractorMigrationBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystem" "MigrationSourceSystem" NOT NULL,
    "waveLabel" TEXT,
    "status" "ContractorMigrationBatchStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "statsJson" JSONB,
    CONSTRAINT "ContractorMigrationBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hcm_contractor_staging" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "migrationBatchId" TEXT NOT NULL,
    "sourceSystem" "MigrationSourceSystem" NOT NULL DEFAULT 'ORACLE_HCM',
    "sourcePersonId" TEXT NOT NULL,
    "sourcePersonNumber" TEXT,
    "sourcePayloadJson" JSONB NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "normalizedPayloadJson" JSONB,
    "extractTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordAction" "HcmStagingRecordAction" NOT NULL DEFAULT 'SNAPSHOT',
    "pipelineStatus" "HcmMigrationPipelineStatus" NOT NULL DEFAULT 'EXTRACTED',
    "validationStatus" "HcmStagingValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationErrorsJson" JSONB,
    "responsibleManagerValidationStatus" "HcmResponsibleManagerValidationStatus",
    "promotedContractorId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "issuedContractorBusinessId" TEXT,
    CONSTRAINT "hcm_contractor_staging_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hcm_contractor_quarantine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stagingId" TEXT NOT NULL,
    "reasonCode" "HcmQuarantineReasonCode" NOT NULL,
    "detailsJson" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hcm_contractor_quarantine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contractor_identity_map" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractorBusinessId" TEXT NOT NULL,
    "legacyHcmPersonId" TEXT,
    "legacyHcmPersonNumber" TEXT,
    "externalPersonId" TEXT,
    "igaIdentityId" TEXT,
    "adObjectId" TEXT,
    "status" "ContractorIdentityMapStatus" NOT NULL DEFAULT 'ACTIVE',
    "authoritativeSource" "MigrationSourceSystem" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contractor_identity_map_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contractor_migration_audit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "migrationBatchId" TEXT,
    "stagingId" TEXT,
    "contractorId" TEXT,
    "action" "ContractorMigrationAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contractor_migration_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ctr_sequence_registry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orgCode" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "lastIssuedAt" TIMESTAMP(3),
    "lastIssuedTo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ctr_sequence_registry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hcm_contractor_staging_migrationBatchId_sourcePersonId_sourc_key" ON "hcm_contractor_staging"("migrationBatchId", "sourcePersonId", "sourceHash");
CREATE INDEX IF NOT EXISTS "hcm_contractor_staging_migrationBatchId_validationStatus_idx" ON "hcm_contractor_staging"("migrationBatchId", "validationStatus");
CREATE INDEX IF NOT EXISTS "hcm_contractor_staging_organizationId_sourcePersonId_idx" ON "hcm_contractor_staging"("organizationId", "sourcePersonId");
CREATE INDEX IF NOT EXISTS "hcm_contractor_staging_sourceHash_idx" ON "hcm_contractor_staging"("sourceHash");
CREATE INDEX IF NOT EXISTS "hcm_contractor_staging_validationStatus_pipelineStatus_idx" ON "hcm_contractor_staging"("validationStatus", "pipelineStatus");

CREATE INDEX IF NOT EXISTS "hcm_contractor_quarantine_organizationId_reasonCode_idx" ON "hcm_contractor_quarantine"("organizationId", "reasonCode");
CREATE INDEX IF NOT EXISTS "hcm_contractor_quarantine_stagingId_idx" ON "hcm_contractor_quarantine"("stagingId");

CREATE UNIQUE INDEX IF NOT EXISTS "contractor_identity_map_contractorBusinessId_key" ON "contractor_identity_map"("contractorBusinessId");
CREATE INDEX IF NOT EXISTS "contractor_identity_map_contractorId_idx" ON "contractor_identity_map"("contractorId");
CREATE INDEX IF NOT EXISTS "contractor_identity_map_legacyHcmPersonId_idx" ON "contractor_identity_map"("legacyHcmPersonId");
CREATE INDEX IF NOT EXISTS "contractor_identity_map_legacyHcmPersonNumber_idx" ON "contractor_identity_map"("legacyHcmPersonNumber");

CREATE INDEX IF NOT EXISTS "contractor_migration_audit_migrationBatchId_createdAt_idx" ON "contractor_migration_audit"("migrationBatchId", "createdAt");
CREATE INDEX IF NOT EXISTS "contractor_migration_audit_stagingId_idx" ON "contractor_migration_audit"("stagingId");
CREATE INDEX IF NOT EXISTS "contractor_migration_audit_contractorId_idx" ON "contractor_migration_audit"("contractorId");

CREATE UNIQUE INDEX IF NOT EXISTS "ctr_sequence_registry_organizationId_key" ON "ctr_sequence_registry"("organizationId");

CREATE INDEX IF NOT EXISTS "ContractorMigrationBatch_organizationId_status_idx" ON "ContractorMigrationBatch"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ContractorMigrationBatch_sourceSystem_startedAt_idx" ON "ContractorMigrationBatch"("sourceSystem", "startedAt");

DO $$ BEGIN ALTER TABLE "ContractorMigrationBatch" ADD CONSTRAINT "ContractorMigrationBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "hcm_contractor_staging" ADD CONSTRAINT "hcm_contractor_staging_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "hcm_contractor_staging" ADD CONSTRAINT "hcm_contractor_staging_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "ContractorMigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "hcm_contractor_quarantine" ADD CONSTRAINT "hcm_contractor_quarantine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "hcm_contractor_quarantine" ADD CONSTRAINT "hcm_contractor_quarantine_stagingId_fkey" FOREIGN KEY ("stagingId") REFERENCES "hcm_contractor_staging"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "contractor_identity_map" ADD CONSTRAINT "contractor_identity_map_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "contractor_migration_audit" ADD CONSTRAINT "contractor_migration_audit_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "ContractorMigrationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contractor_migration_audit" ADD CONSTRAINT "contractor_migration_audit_stagingId_fkey" FOREIGN KEY ("stagingId") REFERENCES "hcm_contractor_staging"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contractor_migration_audit" ADD CONSTRAINT "contractor_migration_audit_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "ctr_sequence_registry" ADD CONSTRAINT "ctr_sequence_registry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
