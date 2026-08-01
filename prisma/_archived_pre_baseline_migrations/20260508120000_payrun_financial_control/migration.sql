-- PR-PAYRUN-GOV-3A: payroll register vs payment export financial control

CREATE TYPE "PayrunFinancialControlStatus" AS ENUM ('MATCH', 'VARIANCE', 'BLOCKED');

CREATE TABLE "payrun_financial_controls" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "payment_batch_id" TEXT,
    "employee_count_register" INTEGER NOT NULL,
    "employee_count_export" INTEGER NOT NULL,
    "total_net_register" DECIMAL(18,2) NOT NULL,
    "total_net_export" DECIMAL(18,2) NOT NULL,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "variance_employee_count" INTEGER NOT NULL,
    "status" "PayrunFinancialControlStatus" NOT NULL,
    "threshold_policy" TEXT NOT NULL DEFAULT 'DEFAULT_ZAR_0_05',
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_financial_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrun_financial_controls_payrun_id_key" ON "payrun_financial_controls"("payrun_id");

CREATE INDEX "payrun_financial_controls_payment_batch_id_idx" ON "payrun_financial_controls"("payment_batch_id");

ALTER TABLE "payrun_financial_controls" ADD CONSTRAINT "payrun_financial_controls_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payrun_financial_controls" ADD CONSTRAINT "payrun_financial_controls_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
