-- GOV-4 — post-reversal / correction reconciliation impact flags (minimal v1).
ALTER TABLE "payruns" ADD COLUMN "financial_control_impacted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payruns" ADD COLUMN "bank_reconciliation_impacted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payruns" ADD COLUMN "gl_reconciliation_impacted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payrun_reversal_workflows" ADD COLUMN "downstream_reconciliation_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payrun_correction_approvals" ADD COLUMN "downstream_reconciliation_required" BOOLEAN NOT NULL DEFAULT false;
