import { render, screen } from '@testing-library/react';
import { PolicyEvaluationOutcomeDetail } from '@/components/policy-evaluation/PolicyEvaluationOutcomeDetail';

describe('PolicyEvaluationOutcomeDetail', () => {
  it('shows evaluation chain when policy restricted', () => {
    render(
      <PolicyEvaluationOutcomeDetail
        row={{
          pdpRestrictionsApplied: true,
          policyDecision: 'Restricted',
          policyEvaluationSteps: [
            {
              capability: 'Workforce Governance',
              status: 'FAIL',
              finding: 'No Responsible Manager assigned',
            },
          ],
          policyResolutionAction: 'Assign a Responsible Manager',
        }}
      />,
    );

    expect(screen.getByText('Policy Evaluation')).toBeInTheDocument();
    expect(screen.getAllByText('Restricted')).toHaveLength(2);
    expect(screen.getByText('Workforce Governance')).toBeInTheDocument();
    expect(screen.getByText('No Responsible Manager assigned')).toBeInTheDocument();
    expect(screen.getByText('Assign a Responsible Manager')).toBeInTheDocument();
    expect(screen.getByTestId('policy-evaluation-step-fail')).toBeInTheDocument();
  });

  it('derives evaluation chain from legacy flat fields', () => {
    render(
      <PolicyEvaluationOutcomeDetail
        row={{
          pdpRestrictionsApplied: true,
          policyDecision: 'Restricted',
          policyEvaluationReason: 'No Responsible Manager assigned',
          policySourceTruth: 'Workforce Governance',
          policyResolutionAction: 'Assign a Responsible Manager',
        }}
      />,
    );

    expect(screen.getByText('Workforce Governance')).toBeInTheDocument();
    expect(screen.getByText('No Responsible Manager assigned')).toBeInTheDocument();
  });

  it('renders dash when no policy decision', () => {
    render(<PolicyEvaluationOutcomeDetail row={{ pdpRestrictionsApplied: false }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
