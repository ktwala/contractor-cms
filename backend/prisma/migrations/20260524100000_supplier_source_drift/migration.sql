-- PR-CMS-CONNECTOR-4 — source drift registry

CREATE TYPE "SupplierSourceDriftType" AS ENUM (
  'SUPPLIER_SOURCE_DRIFT',
  'SOURCE_RECORD_MISSING',
  'DUPLICATE_EXTERNAL_ID',
  'GOVERNANCE_STATE_CONFLICT',
  'RECONCILIATION_CONFLICT',
  'CHECKPOINT_GAP'
);

CREATE TYPE "SupplierSourceDriftSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "SupplierSourceDriftStatus" AS ENUM (
  'DETECTED',
  'CLASSIFIED',
  'UNDER_REVIEW',
  'RESOLVED',
  'ARCHIVED'
);

CREATE TABLE "supplier_source_drifts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "supplierId" TEXT,
  "stagingId" TEXT,
  "sourceSystem" "SupplierSourceSystem" NOT NULL,
  "externalSupplierId" TEXT,
  "driftType" "SupplierSourceDriftType" NOT NULL,
  "severity" "SupplierSourceDriftSeverity" NOT NULL,
  "status" "SupplierSourceDriftStatus" NOT NULL DEFAULT 'DETECTED',
  "driftFingerprint" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "classifiedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "detectedByRunId" TEXT,
  "sourceSnapshot" JSONB,
  "governanceSnapshot" JSONB,
  "resolutionNotes" TEXT,
  "assignedToUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_source_drifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_source_drifts_organizationId_driftFingerprint_key"
  ON "supplier_source_drifts"("organizationId", "driftFingerprint");

CREATE INDEX "supplier_source_drifts_organizationId_status_idx"
  ON "supplier_source_drifts"("organizationId", "status");

CREATE INDEX "supplier_source_drifts_organizationId_severity_idx"
  ON "supplier_source_drifts"("organizationId", "severity");

CREATE INDEX "supplier_source_drifts_organizationId_driftType_idx"
  ON "supplier_source_drifts"("organizationId", "driftType");

CREATE INDEX "supplier_source_drifts_supplierId_idx"
  ON "supplier_source_drifts"("supplierId");

ALTER TABLE "supplier_source_drifts"
  ADD CONSTRAINT "supplier_source_drifts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_source_drifts"
  ADD CONSTRAINT "supplier_source_drifts_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_source_drifts"
  ADD CONSTRAINT "supplier_source_drifts_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
