-- PR-CMS-CONNECTOR-1A-C — Oracle Procurement sync run ledger + org checkpoints

CREATE TYPE "SupplierSourceSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');
CREATE TYPE "SupplierSourceSyncRunMode" AS ENUM ('FULL', 'INCREMENTAL', 'REPLAY');
CREATE TYPE "OracleSupplierConnectorHealth" AS ENUM (
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'AUTH_FAILED',
  'RATE_LIMITED',
  'DISABLED',
  'UNKNOWN'
);

ALTER TABLE "Organization"
  ADD COLUMN "oracleSupplierLastSuccessfulSyncAt" TIMESTAMP(3),
  ADD COLUMN "oracleSupplierLastCursor" TEXT,
  ADD COLUMN "oracleSupplierConnectorHealth" "OracleSupplierConnectorHealth" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "oracleSupplierConnectorLastError" TEXT;

CREATE TABLE "supplier_source_sync_runs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceSystem" "SupplierSourceSystem" NOT NULL,
  "status" "SupplierSourceSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "mode" "SupplierSourceSyncRunMode" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "requestedByUserId" TEXT,
  "checkpointFrom" TIMESTAMP(3),
  "checkpointTo" TIMESTAMP(3),
  "nextCursor" TEXT,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_source_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_source_sync_runs_organizationId_startedAt_idx"
  ON "supplier_source_sync_runs"("organizationId", "startedAt" DESC);

CREATE INDEX "supplier_source_sync_runs_organizationId_status_idx"
  ON "supplier_source_sync_runs"("organizationId", "status");

ALTER TABLE "supplier_source_sync_runs"
  ADD CONSTRAINT "supplier_source_sync_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_source_sync_runs"
  ADD CONSTRAINT "supplier_source_sync_runs_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
