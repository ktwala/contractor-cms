-- PR-CMS-OPERATIONS-1D1 — backfill UNMATCHED → NEW and set default

UPDATE "supplier_source_staging"
SET "matchStatus" = 'NEW'
WHERE "matchStatus" = 'UNMATCHED';

ALTER TABLE "supplier_source_staging"
  ALTER COLUMN "matchStatus" SET DEFAULT 'NEW';

ALTER TABLE "supplier_source_staging"
  ADD COLUMN IF NOT EXISTS "matchReason" TEXT;
