-- PR-IDENTITY-ACQUISITION-MODEL-1 / ADR-013 — acquisition authority column + backfill

CREATE TYPE "AcquisitionModel" AS ENUM ('SUPPLIER', 'INDEPENDENT');

ALTER TABLE "Contractor"
  ADD COLUMN "acquisitionModel" "AcquisitionModel" NOT NULL DEFAULT 'SUPPLIER';

UPDATE "Contractor"
SET "acquisitionModel" = 'SUPPLIER';

CREATE INDEX "Contractor_acquisitionModel_idx" ON "Contractor"("acquisitionModel");
