import { Injectable } from '@nestjs/common';
import {
  CtcEvaluatedScenario,
  CtcOptimisationMode,
  CtcOutcomeStatus,
  CtcRecommendationLabel,
  MedicalFundingModel,
  SimpleCtcOptimiserResponse,
  SimpleCtcOptimiserSummary,
  SimpleCtcRecommendation,
} from '../domain/ctc-optimiser.types';
import { calculateDisposableIncome } from './ctc-disposable-income.calculator';

@Injectable()
export class CtcResponseMapper {
  mapToAdvisoryResponse(
    runId: string,
    mode: CtcOptimisationMode,
    ctc: number,
    targetNet: number | undefined,
    ranked: CtcEvaluatedScenario[],
    medicalFundingModel: MedicalFundingModel = 'EMPLOYER_FUNDED',
    medicalAmount: number = 0,
  ): SimpleCtcOptimiserResponse {
    const valid = ranked.filter((r) => r.evaluation && r.policy.status !== 'BLOCK');
    const bestNet = valid.length > 0 ? Math.max(...valid.map((r) => r.evaluation!.netPay)) : 0;

    const gap = targetNet != null ? bestNet - targetNet : undefined;
    const outcomeStatus = this.deriveOutcomeStatus(mode, targetNet, bestNet);

    const bestDisposable = calculateDisposableIncome({
      netPay: bestNet,
      medicalFundingModel,
      medicalAmount,
    });

    const summary: SimpleCtcOptimiserSummary = {
      optimisationMode: mode,
      ctc,
      targetNet,
      bestAchievedNet: bestNet,
      gapToTarget: gap,
      outcomeStatus,
      medicalFundingModel,
      medicalAmount,
      trueDisposableIncome: bestDisposable.trueDisposableIncome,
      disposableBreakdown: {
        netPay: bestDisposable.netPay,
        employerFundedBenefits: bestDisposable.employerFundedBenefits,
        personalObligations: bestDisposable.personalObligations,
      },
    };

    const recommendations = this.assignLabels(valid.slice(0, 3), mode, medicalFundingModel, medicalAmount);
    const suggestions = this.generateSuggestions(outcomeStatus, valid.length, mode);

    return { runId, summary, recommendations, suggestions };
  }

  private deriveOutcomeStatus(
    mode: CtcOptimisationMode,
    targetNet: number | undefined,
    bestNet: number,
  ): CtcOutcomeStatus {
    if (mode !== 'TARGET_NET' || !targetNet || targetNet <= 0) {
      return bestNet > 0 ? 'ON_TARGET' : 'UNREACHABLE_UNDER_RULES';
    }

    const gap = bestNet - targetNet;
    const pct = Math.abs(gap) / targetNet;

    if (pct <= 0.02) return 'ON_TARGET';
    if (pct <= 0.10) return 'CLOSE';
    if (bestNet > 0) return 'BELOW_TARGET';
    return 'UNREACHABLE_UNDER_RULES';
  }

  private assignLabels(
    items: CtcEvaluatedScenario[],
    mode: CtcOptimisationMode,
    medicalFundingModel: MedicalFundingModel,
    medicalAmount: number,
  ): SimpleCtcRecommendation[] {
    if (items.length === 0) return [];

    const labelAssignments = this.deriveLabelAssignments(items, mode);

    return items.map((item, idx) => {
      const label = labelAssignments[idx] ?? 'Recommended';
      const disposable = calculateDisposableIncome({
        netPay: item.evaluation!.netPay,
        medicalFundingModel,
        medicalAmount,
      });
      return {
        label,
        policyStatus: item.policy.status === 'BLOCK' ? 'WARN' : (item.policy.status as 'PASS' | 'WARN'),
        breakdown: item.scenario,
        payroll: {
          grossEarnings: item.evaluation!.grossEarnings,
          taxableIncome: item.evaluation!.taxableIncome,
          paye: item.evaluation!.paye,
          uif: item.evaluation!.uif,
          netPay: item.evaluation!.netPay,
        },
        trueDisposableIncome: disposable.trueDisposableIncome,
        disposableBreakdown: {
          netPay: disposable.netPay,
          employerFundedBenefits: disposable.employerFundedBenefits,
          personalObligations: disposable.personalObligations,
        },
        explanations: item.explanations,
        warnings: item.warnings,
      };
    });
  }

  private deriveLabelAssignments(
    items: CtcEvaluatedScenario[],
    _mode: CtcOptimisationMode,
  ): CtcRecommendationLabel[] {
    const labels: CtcRecommendationLabel[] = ['Recommended'];

    if (items.length < 2) return labels;

    const bestNetIdx = items.reduce(
      (best, item, idx) => (item.evaluation!.netPay > items[best].evaluation!.netPay ? idx : best),
      0,
    );

    const bestRetIdx = items.reduce(
      (best, item, idx) =>
        item.scenario.retirementContribution > items[best].scenario.retirementContribution ? idx : best,
      0,
    );

    for (let i = 1; i < items.length; i++) {
      if (i === bestRetIdx && items[i].scenario.retirementContribution > items[0].scenario.retirementContribution) {
        labels.push('Stronger Retirement');
      } else if (i === bestNetIdx && items[i].evaluation!.netPay > items[0].evaluation!.netPay) {
        labels.push('Higher Take-Home');
      } else if (items[i].warnings.length === 0 && items[i].policy.status === 'PASS') {
        labels.push('Conservative');
      } else {
        labels.push('Higher Take-Home');
      }
    }

    return labels;
  }

  private generateSuggestions(
    status: CtcOutcomeStatus,
    validCount: number,
    _mode: CtcOptimisationMode,
  ): string[] {
    if (validCount === 0) {
      return [
        'No valid package structure could meet the current constraints.',
        'Try lowering the retirement minimum, allowing travel allowance, or reducing the target net.',
      ];
    }

    if (status === 'UNREACHABLE_UNDER_RULES') {
      return [
        'The target net pay is unreachable under current constraints and tax rules.',
        'Consider reducing the target net, lowering medical aid, or allowing travel allowance.',
      ];
    }

    if (status === 'BELOW_TARGET') {
      return [
        'The best achievable net pay falls below your target under current rules.',
        'Reducing retirement minimum or allowing travel allowance may help close the gap.',
      ];
    }

    return [];
  }
}
