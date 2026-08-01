-- GOV-3D-1: durable period close for temporal-mutation guard (register truth layer).
ALTER TABLE "pay_periods" ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "closed_by_user_id" TEXT;

CREATE INDEX "pay_periods_closed_at_idx" ON "pay_periods" ("closed_at");
