-- PR-WORKFORCE-STATE-MODEL-1 — workforce plane column + backfill from isActive

CREATE TYPE "ContractorWorkforceState" AS ENUM (
  'NOMINATED',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
  'BLACKLISTED'
);

ALTER TABLE "Contractor"
  ADD COLUMN "workforceState" "ContractorWorkforceState" NOT NULL DEFAULT 'ACTIVE';

UPDATE "Contractor"
SET "workforceState" = 'ACTIVE'
WHERE "isActive" = true;

UPDATE "Contractor"
SET "workforceState" = 'TERMINATED'
WHERE "isActive" = false;

CREATE INDEX "Contractor_workforceState_idx" ON "Contractor"("workforceState");
