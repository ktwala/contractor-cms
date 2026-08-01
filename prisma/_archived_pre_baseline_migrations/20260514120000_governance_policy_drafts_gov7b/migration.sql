-- GOV-7B — policy change draft / approval / activation (replaces direct version create).

CREATE TYPE "GovernancePolicyDraftStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ACTIVATED',
  'CANCELLED'
);

CREATE TABLE "payroll_governance_policy_drafts" (
    "id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "scope" "GovernancePolicyScope" NOT NULL,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "proposed_value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "impact_preview_hash" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" "GovernancePolicyDraftStatus" NOT NULL,
    "activation_policy_id" TEXT,
    "approval_reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_governance_policy_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_governance_policy_drafts_activation_policy_id_key" ON "payroll_governance_policy_drafts"("activation_policy_id");

CREATE INDEX "payroll_governance_policy_drafts_status_idx" ON "payroll_governance_policy_drafts"("status");

CREATE INDEX "payroll_governance_policy_drafts_policy_scope_idx" ON "payroll_governance_policy_drafts"("policy_key", "scope", "legal_entity_id", "pay_group_id");

CREATE INDEX "payroll_governance_policy_drafts_requested_by_user_id_idx" ON "payroll_governance_policy_drafts"("requested_by_user_id");

ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_activation_policy_id_fkey" FOREIGN KEY ("activation_policy_id") REFERENCES "payroll_governance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
