import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import {
  CtcEvaluatedScenario,
  CtcScenarioScoreBreakdown,
} from '../domain/ctc-optimiser.types';

@Injectable()
export class CtcScenarioRankerService {
  private readonly MAX_RESULTS = 5;

  rank(input: RunCtcOptimiserDto, items: CtcEvaluatedScenario[]): CtcEvaluatedScenario[] {
    const viable = items.filter((item) => !this.shouldDiscard(input, item));

    const scored = viable.map((item) => {
      if (!item.evaluation) {
        return {
          ...item,
          rank: null,
          score: {
            netFitScore: 0,
            complianceScore: 0,
            policyScore: 0,
            sustainabilityScore: 0,
            simplicityScore: 0,
            totalScore: 0,
          } as CtcScenarioScoreBreakdown,
          checksum: this.checksum(item),
        };
      }

      const netFitScore = this.netFitScore(input, item.evaluation.netPay);
      const complianceScore = item.policy.status === 'PASS' ? 100 : 75;
      const policyScore = item.policy.status === 'PASS' ? 100 : 80;

      const retirementRatio = item.scenario.retirementContribution / input.ctc;
      const sustainabilityScore = Math.min(100, Math.round(retirementRatio * 700));

      const fillerRatio = item.scenario.otherAllowanceTaxable / input.ctc;
      const simplicityScore = Math.max(20, 100 - Math.round(fillerRatio * 300));

      const weights = this.getWeights(input.optimisationMode);
      const totalScore =
        netFitScore * weights.netFit +
        complianceScore * weights.compliance +
        policyScore * weights.policy +
        sustainabilityScore * weights.sustainability +
        simplicityScore * weights.simplicity;

      return {
        ...item,
        score: {
          netFitScore,
          complianceScore,
          policyScore,
          sustainabilityScore,
          simplicityScore,
          totalScore: Number(totalScore.toFixed(2)),
        } as CtcScenarioScoreBreakdown,
        checksum: this.checksum(item),
      };
    });

    const sorted = scored.sort(
      (a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0),
    );

    const pruned = this.removeDominated(sorted);

    return pruned.slice(0, this.MAX_RESULTS).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  private shouldDiscard(input: RunCtcOptimiserDto, item: CtcEvaluatedScenario): boolean {
    if (!item.evaluation) return true;

    const netPay = item.evaluation.netPay ?? 0;
    const paye = item.evaluation.paye ?? 0;
    const taxableIncome = item.evaluation.taxableIncome ?? 0;
    const otherTaxable = item.scenario.otherAllowanceTaxable ?? 0;

    if (!Number.isFinite(netPay) || netPay <= 0) return true;
    if (!Number.isFinite(paye) || paye < 0) return true;
    if (!Number.isFinite(taxableIncome) || taxableIncome < 0) return true;
    if (otherTaxable > input.ctc * 0.10) return true;

    if (input.optimisationMode === 'TARGET_NET' && input.targetNet && input.targetNet > 0) {
      if (netPay < input.targetNet * 0.60) return true;
    }

    if (item.policy.status === 'BLOCK') return true;

    return false;
  }

  private netFitScore(input: RunCtcOptimiserDto, netPay: number): number {
    if (input.optimisationMode === 'MAX_NET') {
      return Math.max(0, Math.min(100, Math.round((netPay / input.ctc) * 130)));
    }

    if (input.targetNet && input.targetNet > 0) {
      const diff = Math.abs(netPay - input.targetNet);
      const pct = diff / input.targetNet;
      if (pct <= 0.02) return 100;
      if (pct <= 0.05) return 92;
      if (pct <= 0.10) return 80;
      if (pct <= 0.15) return 60;
      if (pct <= 0.20) return 35;
      return 0;
    }

    return 70;
  }

  private removeDominated(items: CtcEvaluatedScenario[]): CtcEvaluatedScenario[] {
    const result: CtcEvaluatedScenario[] = [];

    for (const candidate of items) {
      if (!candidate.evaluation) continue;
      const dominated = result.some((existing) => this.dominates(existing, candidate));
      if (!dominated) {
        result.push(candidate);
      }
    }

    return result;
  }

  private dominates(a: CtcEvaluatedScenario, b: CtcEvaluatedScenario): boolean {
    if (!a.evaluation || !b.evaluation) return false;

    const aWarnings = a.warnings?.length ?? 0;
    const bWarnings = b.warnings?.length ?? 0;

    return (
      a.evaluation.netPay >= b.evaluation.netPay &&
      a.evaluation.paye <= b.evaluation.paye &&
      a.scenario.retirementContribution >= b.scenario.retirementContribution &&
      aWarnings <= bWarnings &&
      (
        a.evaluation.netPay > b.evaluation.netPay ||
        a.evaluation.paye < b.evaluation.paye ||
        a.scenario.retirementContribution > b.scenario.retirementContribution ||
        aWarnings < bWarnings
      )
    );
  }

  private getWeights(mode: string): {
    netFit: number;
    compliance: number;
    policy: number;
    sustainability: number;
    simplicity: number;
  } {
    switch (mode) {
      case 'MAX_NET':
        return { netFit: 0.60, compliance: 0.15, policy: 0.05, sustainability: 0.10, simplicity: 0.10 };
      case 'BALANCED':
        return { netFit: 0.35, compliance: 0.20, policy: 0.05, sustainability: 0.25, simplicity: 0.15 };
      case 'TARGET_NET':
      default:
        return { netFit: 0.65, compliance: 0.15, policy: 0.05, sustainability: 0.10, simplicity: 0.05 };
    }
  }

  private checksum(item: CtcEvaluatedScenario): string {
    return createHash('sha256')
      .update(JSON.stringify({ scenario: item.scenario, evaluation: item.evaluation }))
      .digest('hex');
  }
}
