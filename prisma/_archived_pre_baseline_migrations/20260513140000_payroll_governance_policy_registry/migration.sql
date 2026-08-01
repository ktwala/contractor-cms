-- PR-PAYRUN-GOV-6A — governance policy registry (rules-of-governance storage).
CREATE TYPE "GovernancePolicyScope" AS ENUM ('GLOBAL', 'LEGAL_ENTITY', 'PAY_GROUP');

CREATE TABLE "payroll_governance_policies" (
    "id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "scope" "GovernancePolicyScope" NOT NULL,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "current_value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "approval_reference" TEXT,
    "superseded_by_policy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_governance_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_governance_policies_policy_key_scope_idx" ON "payroll_governance_policies"("policy_key", "scope", "legal_entity_id", "pay_group_id");

CREATE INDEX "payroll_governance_policies_legal_entity_id_idx" ON "payroll_governance_policies"("legal_entity_id");

CREATE INDEX "payroll_governance_policies_pay_group_id_idx" ON "payroll_governance_policies"("pay_group_id");

CREATE INDEX "payroll_governance_policies_superseded_by_policy_id_idx" ON "payroll_governance_policies"("superseded_by_policy_id");

ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_superseded_by_policy_id_fkey" FOREIGN KEY ("superseded_by_policy_id") REFERENCES "payroll_governance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
