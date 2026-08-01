-- PR-CTR-CONNECTOR-1A–1C — HCM contractor connector sync ledger + correlation staging

CREATE TYPE "ContractorSourceSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');
CREATE TYPE "ContractorSourceSyncRunMode" AS ENUM ('FULL', 'INCREMENTAL', 'REPLAY');
CREATE TYPE "HcmContractorCorrelationMatchStatus" AS ENUM ('NEW', 'POSSIBLE_MATCH', 'MATCHED', 'CONFLICT', 'UNMATCHED');
CREATE TYPE "HcmContractorCorrelationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'MANUAL_REVIEW');
CREATE TYPE "HcmOracleConnectorHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'STALE', 'AUTH_FAILED', 'RATE_LIMITED', 'DISABLED', 'UNKNOWN');

ALTER TABLE "Organization" ADD COLUMN "oracleHcmLastSuccessfulSyncAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "oracleHcmLastCursor" TEXT;
ALTER TABLE "Organization" ADD COLUMN "oracleHcmConnectorHealth" "HcmOracleConnectorHealth" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Organization" ADD COLUMN "oracleHcmConnectorLastError" TEXT;

CREATE TABLE "contractor_source_sync_runs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceSystem" "MigrationSourceSystem" NOT NULL DEFAULT 'ORACLE_HCM',
  "status" "ContractorSourceSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "mode" "ContractorSourceSyncRunMode" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "requestedByUserId" TEXT,
  "checkpointFrom" TIMESTAMP(3),
  "checkpointTo" TIMESTAMP(3),
  "nextCursor" TEXT,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "correlationFailures" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contractor_source_sync_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hcm_contractor_staging" ALTER COLUMN "migrationBatchId" DROP NOT NULL;
ALTER TABLE "hcm_contractor_staging" ADD COLUMN "contractorSourceSyncRunId" TEXT;
ALTER TABLE "hcm_contractor_staging" ADD COLUMN "correlationMatchStatus" "HcmContractorCorrelationMatchStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "hcm_contractor_staging" ADD COLUMN "correlationConfidence" "HcmContractorCorrelationConfidence";
ALTER TABLE "hcm_contractor_staging" ADD COLUMN "correlationMatchReason" TEXT;
ALTER TABLE "hcm_contractor_staging" ADD COLUMN "proposedContractorId" TEXT;

CREATE UNIQUE INDEX "hcm_contractor_staging_organizationId_sourceSystem_sourcePersonId_key"
  ON "hcm_contractor_staging"("organizationId", "sourceSystem", "sourcePersonId");

CREATE INDEX "hcm_contractor_staging_contractorSourceSyncRunId_idx"
  ON "hcm_contractor_staging"("contractorSourceSyncRunId");
CREATE INDEX "hcm_contractor_staging_correlationMatchStatus_idx"
  ON "hcm_contractor_staging"("correlationMatchStatus");

CREATE INDEX "contractor_source_sync_runs_organizationId_startedAt_idx"
  ON "contractor_source_sync_runs"("organizationId", "startedAt" DESC);
CREATE INDEX "contractor_source_sync_runs_organizationId_status_idx"
  ON "contractor_source_sync_runs"("organizationId", "status");

ALTER TABLE "contractor_source_sync_runs"
  ADD CONSTRAINT "contractor_source_sync_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_source_sync_runs"
  ADD CONSTRAINT "contractor_source_sync_runs_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hcm_contractor_staging"
  ADD CONSTRAINT "hcm_contractor_staging_contractorSourceSyncRunId_fkey"
  FOREIGN KEY ("contractorSourceSyncRunId") REFERENCES "contractor_source_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hcm_contractor_staging"
  ADD CONSTRAINT "hcm_contractor_staging_proposedContractorId_fkey"
  FOREIGN KEY ("proposedContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hcm_contractor_staging" DROP CONSTRAINT IF EXISTS "hcm_contractor_staging_migrationBatchId_fkey";
ALTER TABLE "hcm_contractor_staging"
  ADD CONSTRAINT "hcm_contractor_staging_migrationBatchId_fkey"
  FOREIGN KEY ("migrationBatchId") REFERENCES "ContractorMigrationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
