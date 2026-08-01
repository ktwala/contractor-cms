-- GOV-3D-2: governed reversal / correction objects (minimal v1).
CREATE TYPE "PayrunReversalWorkflowStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "PayrunCorrectionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

CREATE TABLE "payrun_reversal_workflows" (
    "id" TEXT NOT NULL,
    "source_payrun_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiated_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" "PayrunReversalWorkflowStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reversal_payrun_id" TEXT,
    "audit_chain" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_reversal_workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrun_reversal_workflows_reversal_payrun_id_key" ON "payrun_reversal_workflows"("reversal_payrun_id");

CREATE INDEX "payrun_reversal_workflows_source_payrun_id_status_idx" ON "payrun_reversal_workflows"("source_payrun_id", "status");

ALTER TABLE "payrun_reversal_workflows" ADD CONSTRAINT "payrun_reversal_workflows_source_payrun_id_fkey" FOREIGN KEY ("source_payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payrun_reversal_workflows" ADD CONSTRAINT "payrun_reversal_workflows_reversal_payrun_id_fkey" FOREIGN KEY ("reversal_payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payrun_correction_approvals" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "requested_change_scope" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "approver_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_reference" TEXT NOT NULL,
    "resulting_adjustment_payrun_id" TEXT,
    "status" "PayrunCorrectionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_correction_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payrun_correction_approvals_approval_reference_key" ON "payrun_correction_approvals"("approval_reference");

CREATE UNIQUE INDEX "payrun_correction_approvals_resulting_adjustment_payrun_id_key" ON "payrun_correction_approvals"("resulting_adjustment_payrun_id");

CREATE INDEX "payrun_correction_approvals_payrun_id_status_idx" ON "payrun_correction_approvals"("payrun_id", "status");

ALTER TABLE "payrun_correction_approvals" ADD CONSTRAINT "payrun_correction_approvals_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payrun_correction_approvals" ADD CONSTRAINT "payrun_correction_approvals_resulting_adjustment_payrun_id_fkey" FOREIGN KEY ("resulting_adjustment_payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
