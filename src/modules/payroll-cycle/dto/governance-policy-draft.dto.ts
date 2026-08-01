import type { GovernancePolicyDraftStatus, GovernancePolicyScope } from '@prisma/client';

/** API shape for GOV-7B governance policy draft row. */
export type GovernancePolicyDraftDto = {
  id: string;
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  proposed_value: unknown;
  effective_from: string;
  impact_preview_hash: string;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  status: GovernancePolicyDraftStatus;
  activation_policy_id: string | null;
  approval_reference: string;
  created_at: string;
  updated_at: string;
};
