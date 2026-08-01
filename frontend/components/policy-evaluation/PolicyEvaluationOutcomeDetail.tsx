'use client';

import {
  POLICY_EVALUATION_LABELS,
  resolvePolicyEvaluationOutcome,
  type PolicyEvaluationOutcome,
} from '@/lib/policy-evaluation-labels';

type Props = {
  row: PolicyEvaluationOutcome;
  compact?: boolean;
};

function EvaluationStep({
  capability,
  status,
  finding,
}: {
  capability: string;
  status: 'PASS' | 'FAIL';
  finding?: string;
}) {
  const isPass = status === 'PASS';
  const symbol = isPass
    ? POLICY_EVALUATION_LABELS.stepPassSymbol
    : POLICY_EVALUATION_LABELS.stepFailSymbol;

  return (
    <div
      className={isPass ? 'text-emerald-800' : 'text-red-800'}
      data-testid={`policy-evaluation-step-${status.toLowerCase()}`}
    >
      <div className="font-medium">
        <span aria-hidden="true" className="mr-1">
          {symbol}
        </span>
        {capability}
      </div>
      {finding ? <div className="ml-4 text-gray-700">{finding}</div> : null}
    </div>
  );
}

/** Shows Policy Evaluation as an evaluation chain — operators follow why policy decided. */
export function PolicyEvaluationOutcomeDetail({ row, compact = false }: Props) {
  const outcome = resolvePolicyEvaluationOutcome(row);
  if (!outcome.decision) {
    return <span className="text-gray-400">—</span>;
  }

  if (compact) {
    return (
      <span className="text-red-700 font-semibold" data-testid="policy-evaluation-decision">
        {outcome.decision}
      </span>
    );
  }

  return (
    <div
      className="space-y-2 text-xs text-gray-700"
      data-testid="policy-evaluation-outcome-detail"
    >
      <div className="font-semibold text-gray-900">{POLICY_EVALUATION_LABELS.capabilityName}</div>

      <dl className="space-y-1">
        <div>
          <dt className="text-gray-500">{POLICY_EVALUATION_LABELS.policyDecisionPrefix}</dt>
          <dd className="font-semibold text-red-800">{outcome.decision}</dd>
        </div>

        {outcome.steps.length > 0 ? (
          <div>
            <dt className="text-gray-500">{POLICY_EVALUATION_LABELS.evaluationLabel}</dt>
            <dd className="mt-1 space-y-1">
              {outcome.steps.map((step) => (
                <EvaluationStep
                  key={`${step.capability}-${step.status}`}
                  capability={step.capability}
                  status={step.status}
                  finding={step.finding}
                />
              ))}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-gray-500">{POLICY_EVALUATION_LABELS.resultLabel}</dt>
          <dd className="font-semibold text-red-800">{outcome.decision}</dd>
        </div>

        {outcome.action ? (
          <div>
            <dt className="text-gray-500">{POLICY_EVALUATION_LABELS.nextActionLabel}</dt>
            <dd className="font-medium">{outcome.action}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
