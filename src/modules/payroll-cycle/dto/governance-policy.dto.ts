import type { GovernancePolicyScope } from '@prisma/client';

/** API shape for one payroll governance policy row (GOV-6A). */
export type GovernancePolicyRecordDto = {
  id: string;
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  current_value: unknown;
  effective_from: string;
  changed_by_user_id: string;
  approval_reference: string | null;
  superseded_by_policy_id: string | null;
  created_at: string;
  updated_at: string;
};
