-- PR-PAYRUN-GOV-3C: payroll register vs GL posting reconciliation

CREATE TYPE "PayrunGLReconciliationStatus" AS ENUM ('MATCH', 'VARIANCE', 'BLOCKED');

CREATE TYPE "PayrunGLConfirmationSourceType" AS ENUM ('ERP_IMPORT', 'GL_FILE', 'MANUAL');

CREATE TABLE "payrun_gl_reconciliations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "gl_batch_reference" TEXT NOT NULL,
    "gl_posting_hash" TEXT,
    "register_gross" DECIMAL(18,2) NOT NULL,
    "register_net" DECIMAL(18,2) NOT NULL,
    "register_paye" DECIMAL(18,2) NOT NULL,
    "register_deductions" DECIMAL(18,2) NOT NULL,
    "gl_gross" DECIMAL(18,2) NOT NULL,
    "gl_net" DECIMAL(18,2) NOT NULL,
    "gl_paye" DECIMAL(18,2) NOT NULL,
    "gl_deductions" DECIMAL(18,2) NOT NULL,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "variance_dimensions_json" JSONB,
    "status" "PayrunGLReconciliationStatus" NOT NULL,
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "source_type" "PayrunGLConfirmationSourceType" NOT NULL,
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "imported_by_user_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_gl_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrun_gl_reconciliations_payrun_id_key" ON "payrun_gl_reconciliations"("payrun_id");

CREATE INDEX "payrun_gl_reconciliations_legal_entity_id_gl_posting_hash_idx" ON "payrun_gl_reconciliations"("legal_entity_id", "gl_posting_hash");

ALTER TABLE "payrun_gl_reconciliations" ADD CONSTRAINT "payrun_gl_reconciliations_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
