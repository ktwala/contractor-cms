-- PR-CTR-2B — extend operational Contractor + Engagement for migration provenance
-- PR-DB-MIGRATION-REPAIR: idempotent DDL

ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "contractorBusinessId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "legacySourceSystem" "MigrationSourceSystem";
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "legacySourcePersonId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "migrationBatchId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "migrationStatus" "ContractorMigrationStatus";
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "canonicalizationStatus" "ContractorCanonicalizationStatus";
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "authoritativeUntil" TIMESTAMP(3);

ALTER TABLE "ContractorEngagement" ADD COLUMN IF NOT EXISTS "responsibleManagerValidationStatus" "HcmResponsibleManagerValidationStatus";

CREATE UNIQUE INDEX IF NOT EXISTS "Contractor_contractorBusinessId_key" ON "Contractor"("contractorBusinessId");
CREATE INDEX IF NOT EXISTS "Contractor_legacySourceSystem_legacySourcePersonId_idx" ON "Contractor"("legacySourceSystem", "legacySourcePersonId");
CREATE INDEX IF NOT EXISTS "Contractor_migrationBatchId_idx" ON "Contractor"("migrationBatchId");

DO $$ BEGIN
  ALTER TABLE "Contractor"
    ADD CONSTRAINT "Contractor_migrationBatchId_fkey"
    FOREIGN KEY ("migrationBatchId") REFERENCES "ContractorMigrationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
