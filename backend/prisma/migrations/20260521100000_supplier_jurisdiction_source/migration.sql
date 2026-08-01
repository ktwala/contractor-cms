-- PR-CMS-OPERATIONS-1D0 — jurisdiction + external source foundation

CREATE TYPE "SupplierSourceSystem" AS ENUM ('CMS_NATIVE', 'ORACLE_SUPPLIER_SAAS');
CREATE TYPE "SupplierSourceSyncStatus" AS ENUM ('NOT_SYNCED', 'PENDING', 'SYNCED', 'FAILED');
CREATE TYPE "SupplierSourceStagingMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'CONFLICT', 'IMPORTED', 'REJECTED');

ALTER TABLE "Supplier"
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'ZA',
  ADD COLUMN "sourceSystem" "SupplierSourceSystem" NOT NULL DEFAULT 'CMS_NATIVE',
  ADD COLUMN "externalSupplierId" TEXT,
  ADD COLUMN "externalSupplierNumber" TEXT,
  ADD COLUMN "sourceLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "sourceSyncStatus" "SupplierSourceSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED';

UPDATE "Supplier" SET "countryCode" = UPPER(TRIM("country")) WHERE "country" IS NOT NULL;

CREATE INDEX "Supplier_organizationId_countryCode_idx" ON "Supplier"("organizationId", "countryCode");
CREATE INDEX "Supplier_sourceSystem_externalSupplierId_idx" ON "Supplier"("sourceSystem", "externalSupplierId");

CREATE TABLE "supplier_source_staging" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceSystem" "SupplierSourceSystem" NOT NULL,
  "externalSupplierId" TEXT NOT NULL,
  "supplierNumber" TEXT,
  "name" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "taxRegistrationNumber" TEXT,
  "rawPayload" JSONB NOT NULL,
  "matchStatus" "SupplierSourceStagingMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "proposedSupplierId" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_source_staging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_source_staging_organizationId_sourceSystem_externalSup_key"
  ON "supplier_source_staging"("organizationId", "sourceSystem", "externalSupplierId");
CREATE INDEX "supplier_source_staging_organizationId_matchStatus_idx"
  ON "supplier_source_staging"("organizationId", "matchStatus");
CREATE INDEX "supplier_source_staging_proposedSupplierId_idx"
  ON "supplier_source_staging"("proposedSupplierId");

ALTER TABLE "supplier_source_staging"
  ADD CONSTRAINT "supplier_source_staging_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_source_staging"
  ADD CONSTRAINT "supplier_source_staging_proposedSupplierId_fkey"
  FOREIGN KEY ("proposedSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
