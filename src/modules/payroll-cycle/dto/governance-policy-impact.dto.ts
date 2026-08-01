import type { GovernancePolicyScope } from '@prisma/client';

/** POST /api/payroll-cycle/governance-policies/impact-preview (GOV-7A). */
export type GovernancePolicyImpactPreviewRequestDto = {
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id?: string | null;
  pay_group_id?: string | null;
  current_value: unknown;
  /** ISO date or datetime; normalized server-side for hashing. */
  effective_from?: string;
};

export type GovernancePolicyImpactDiffDto = {
  type: 'THRESHOLD_CHANGE' | 'JUSTIFICATION_LENGTH_CHANGE' | 'MUTATION_POLICY_CHANGE' | 'INITIAL' | 'UNKNOWN';
  direction: 'RELAXED' | 'TIGHTENED' | 'UNCHANGED' | 'INITIAL';
  delta: number | null;
  previous_mode?: string | null;
  proposed_mode?: string | null;
};

export type GovernancePolicyImpactSimulationDto = {
  quality: 'HEURISTIC';
  affected_payruns_checked: number;
  would_unblock_count: number;
  would_block_count: number;
  disclaimer: string;
};

/** Response for impact preview + same `payload_hash` required on POST as `impact_preview_hash`. */
export type GovernancePolicyImpactPreviewResponseDto = {
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  previous_value: unknown | null;
  proposed_value: unknown;
  diff: GovernancePolicyImpactDiffDto;
  simulation: GovernancePolicyImpactSimulationDto;
  payload_hash: string;
};
