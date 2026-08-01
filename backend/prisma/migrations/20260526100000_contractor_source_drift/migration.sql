-- PR-CTR-CONNECTOR-1F — contractor source drift registry

CREATE TYPE "ContractorSourceDriftType" AS ENUM (
  'WORKER_SOURCE_DRIFT',
  'PERSON_CORRELATION_CONFLICT',
  'SUPPLIER_LINK_MISSING',
  'GOVERNANCE_LIFECYCLE_CONFLICT',
  'CHECKPOINT_GAP',
  'DUPLICATE_PERSON_ANCHOR',
  'MISSING_RESPONSIBLE_MANAGER'
);

CREATE TYPE "ContractorSourceDriftSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "ContractorSourceDriftStatus" AS ENUM (
  'DETECTED',
  'CLASSIFIED',
  'UNDER_REVIEW',
  'RESOLVED',
  'ARCHIVED'
);

CREATE TABLE "contractor_source_drifts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contractorId" TEXT,
  "stagingId" TEXT,
  "sourceSystem" "MigrationSourceSystem" NOT NULL DEFAULT 'ORACLE_HCM',
  "sourcePersonId" TEXT,
  "driftType" "ContractorSourceDriftType" NOT NULL,
  "severity" "ContractorSourceDriftSeverity" NOT NULL,
  "status" "ContractorSourceDriftStatus" NOT NULL DEFAULT 'DETECTED',
  "driftFingerprint" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "classifiedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "detectedByRunId" TEXT,
  "sourceSnapshot" JSONB,
  "governanceSnapshot" JSONB,
  "correlationSnapshot" JSONB,
  "resolutionNotes" TEXT,
  "assignedToUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contractor_source_drifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contractor_source_drifts_organizationId_driftFingerprint_key"
  ON "contractor_source_drifts"("organizationId", "driftFingerprint");

CREATE INDEX "contractor_source_drifts_organizationId_status_idx"
  ON "contractor_source_drifts"("organizationId", "status");

CREATE INDEX "contractor_source_drifts_organizationId_severity_idx"
  ON "contractor_source_drifts"("organizationId", "severity");

CREATE INDEX "contractor_source_drifts_organizationId_driftType_idx"
  ON "contractor_source_drifts"("organizationId", "driftType");

CREATE INDEX "contractor_source_drifts_contractorId_idx"
  ON "contractor_source_drifts"("contractorId");

CREATE INDEX "contractor_source_drifts_stagingId_idx"
  ON "contractor_source_drifts"("stagingId");

ALTER TABLE "contractor_source_drifts"
  ADD CONSTRAINT "contractor_source_drifts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contractor_source_drifts"
  ADD CONSTRAINT "contractor_source_drifts_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_source_drifts"
  ADD CONSTRAINT "contractor_source_drifts_stagingId_fkey"
  FOREIGN KEY ("stagingId") REFERENCES "hcm_contractor_staging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_source_drifts"
  ADD CONSTRAINT "contractor_source_drifts_detectedByRunId_fkey"
  FOREIGN KEY ("detectedByRunId") REFERENCES "contractor_source_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_source_drifts"
  ADD CONSTRAINT "contractor_source_drifts_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
