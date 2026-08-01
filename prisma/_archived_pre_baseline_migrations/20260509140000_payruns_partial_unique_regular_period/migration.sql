-- Replace blanket UNIQUE(pay_group_id, period_id) with a partial unique index so that:
-- - A new REGULAR payrun can be created for the same calendar period after the prior run is CANCELLED.
-- - ADJUSTMENT payruns may share the same period_id as the base REGULAR payrun (same pay group).

ALTER TABLE "payruns" DROP CONSTRAINT IF EXISTS "payruns_pay_group_id_period_id_key";
-- Postgres may expose Prisma's @@unique as a named unique index without a separate constraint name.
DROP INDEX IF EXISTS "payruns_pay_group_id_period_id_key";

CREATE UNIQUE INDEX "payruns_one_regular_per_pay_group_period"
ON "payruns" ("pay_group_id", "period_id")
WHERE "period_id" IS NOT NULL
  AND "status" <> 'CANCELLED'::"PayRunStatus"
  AND "payrun_type" = 'REGULAR'::"PayRunType";
