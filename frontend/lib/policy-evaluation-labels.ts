/**
 * Policy Evaluation — operator vocabulary.
 *
 * Policy Evaluation is a decision engine, not a source of truth.
 * Facts are owned by governance capabilities; policy only evaluates facts.
 *
 * Backend module/API paths remain `pdp` for compatibility.
 */

export const POLICY_EVALUATION_LABELS = {
  capabilityName: 'Policy Evaluation',
  doctrine:
    'Facts are owned by governance capabilities. Policy only evaluates facts.',
  decisionColumn: 'Policy decision',
  decisionRestricted: 'Restricted',
  decisionPermit: 'Permit',
  decisionDenied: 'Denied',
  restrictedByPolicy: 'Restricted by policy',
  policyRestrictionsActive: 'Policy restrictions active',
  remediationTypeRestricted: 'Restricted by policy',
  policyRestrictionsActivePopulation: 'Open tasks with a restrict policy decision',
  settingsActivationTitle: 'Policy evaluation rules',
  settingsExceptionsTitle: 'Policy exceptions',
  shadowTelemetryTitle: 'Policy evaluation readiness (shadow mode)',
  /** @deprecated Prefer evaluation chain labels below */
  reasonLabel: 'Reason',
  /** @deprecated Prefer evaluation chain labels below */
  sourceTruthLabel: 'Source truth',
  /** @deprecated Prefer evaluation chain labels below */
  resolutionActionLabel: 'Action',
  policyDecisionPrefix: 'Decision',
  evaluationLabel: 'Evaluation',
  resultLabel: 'Result',
  nextActionLabel: 'Next action',
  stepPassSymbol: '✓',
  stepFailSymbol: '✗',
} as const;

export function formatPolicyDecisionLabel(restricted: boolean): string {
  return restricted ? POLICY_EVALUATION_LABELS.decisionRestricted : '—';
}

export type PolicyEvaluationStep = {
  capability: string;
  status: 'PASS' | 'FAIL';
  finding?: string;
};

export type PolicyEvaluationOutcome = {
  policyDecision?: string;
  policyEvaluationReason?: string;
  policySourceTruth?: string;
  policyResolutionAction?: string;
  policyEvaluationSteps?: PolicyEvaluationStep[];
  pdpRestrictionsApplied?: boolean;
  driftTypeLabel?: string;
};

export type ResolvedPolicyEvaluationOutcome = {
  decision: string | null;
  steps: PolicyEvaluationStep[];
  action: string | null;
};

/** Derive evaluation steps from structured API fields or legacy flat fields. */
export function resolvePolicyEvaluationSteps(
  row: PolicyEvaluationOutcome,
): PolicyEvaluationStep[] {
  if (row.policyEvaluationSteps?.length) {
    return row.policyEvaluationSteps;
  }

  const finding = row.policyEvaluationReason ?? row.driftTypeLabel;
  if (row.policySourceTruth && finding) {
    return [
      {
        capability: row.policySourceTruth,
        status: 'FAIL',
        finding,
      },
    ];
  }

  return [];
}

/** Build evaluation chain display from API fields or row fallbacks. */
export function resolvePolicyEvaluationOutcome(
  row: PolicyEvaluationOutcome,
): ResolvedPolicyEvaluationOutcome {
  const restricted = Boolean(row.pdpRestrictionsApplied);
  if (!restricted) {
    return { decision: null, steps: [], action: null };
  }

  return {
    decision: row.policyDecision ?? POLICY_EVALUATION_LABELS.decisionRestricted,
    steps: resolvePolicyEvaluationSteps(row),
    action: row.policyResolutionAction ?? null,
  };
}
