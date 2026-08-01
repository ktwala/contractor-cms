-- PR-IDENTITY-ACQUISITION-MODEL-2 / ADR-013 Steps 3–6 — org scope, nullable supplierId, independent path

ALTER TABLE "Contractor" ADD COLUMN "organizationId" TEXT;

UPDATE "Contractor" c
SET "organizationId" = s."organizationId"
FROM "Supplier" s
WHERE c."supplierId" = s."id";

ALTER TABLE "Contractor"
  ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Contractor"
  ADD CONSTRAINT "Contractor_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Contractor_organizationId_idx" ON "Contractor"("organizationId");

ALTER TABLE "Contractor" ALTER COLUMN "supplierId" DROP NOT NULL;

ALTER TABLE "Contractor"
  ADD CONSTRAINT "Contractor_acquisition_model_supplier_check"
  CHECK (
    ("acquisitionModel" = 'SUPPLIER' AND "supplierId" IS NOT NULL)
    OR ("acquisitionModel" = 'INDEPENDENT' AND "supplierId" IS NULL)
  );

ALTER TABLE "ContractorEngagement" ALTER COLUMN "contractId" DROP NOT NULL;
