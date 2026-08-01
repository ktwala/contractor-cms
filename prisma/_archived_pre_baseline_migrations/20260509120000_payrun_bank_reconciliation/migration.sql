-- PR-PAYRUN-GOV-3B: payment batch export vs bank confirmation

CREATE TYPE "PayrunBankReconciliationStatus" AS ENUM ('MATCH', 'VARIANCE', 'REJECTED', 'PARTIAL', 'BLOCKED');

CREATE TYPE "PayrunBankConfirmationSourceType" AS ENUM ('BANK_ACK', 'BANK_RETURN', 'MANUAL');

CREATE TABLE "payrun_bank_reconciliations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "payment_batch_id" TEXT NOT NULL,
    "bank_file_reference" TEXT NOT NULL,
    "bank_file_hash" TEXT,
    "export_total" DECIMAL(18,2) NOT NULL,
    "bank_confirmed_total" DECIMAL(18,2) NOT NULL,
    "export_employee_count" INTEGER NOT NULL,
    "bank_confirmed_employee_count" INTEGER NOT NULL,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "partial_count" INTEGER NOT NULL DEFAULT 0,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "status" "PayrunBankReconciliationStatus" NOT NULL,
    "source_type" "PayrunBankConfirmationSourceType" NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "imported_by_user_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrun_bank_reconciliations_payment_batch_id_key" ON "payrun_bank_reconciliations"("payment_batch_id");

CREATE INDEX "payrun_bank_reconciliations_payrun_id_idx" ON "payrun_bank_reconciliations"("payrun_id");

CREATE INDEX "payrun_bank_reconciliations_organization_id_bank_file_hash_idx" ON "payrun_bank_reconciliations"("organization_id", "bank_file_hash");

ALTER TABLE "payrun_bank_reconciliations" ADD CONSTRAINT "payrun_bank_reconciliations_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payrun_bank_reconciliations" ADD CONSTRAINT "payrun_bank_reconciliations_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
