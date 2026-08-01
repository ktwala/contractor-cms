import { Injectable } from '@nestjs/common';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import { CtcScenarioBreakdown } from '../domain/ctc-optimiser.types';

interface ScenarioSeed {
  name: string;
  basicPct: number;
  travelPct: number;
  retirementPct: number;
  reimbursivePct: number;
}

@Injectable()
export class CtcScenarioGeneratorService {
  private readonly MAX_SCENARIOS = 40;

  generate(input: RunCtcOptimiserDto): CtcScenarioBreakdown[] {
    const ctc = input.ctc;
    const medical = input.medicalAid.amount;

    const minBasicPct = (input.constraints.minBasicPercent ?? 55) / 100;
    const maxTravelPct = input.travel.enabled
      ? (input.travel.maxPercent ?? 25) / 100
      : 0;
    const reimbursiveMaxAmount = input.reimbursive.enabled
      ? (input.reimbursive.maxAmount ?? Math.min(ctc * 0.05, 5000))
      : 0;

    const seeds = this.getSeeds(input);
    const scenarios: CtcScenarioBreakdown[] = [];

    const basicDeltas = [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05];
    const travelDeltas = [-0.04, -0.02, 0, 0.02, 0.04];
    const retirementDeltas = [-0.03, -0.01, 0, 0.01, 0.03];
    const reimbursiveCandidates = input.reimbursive.enabled
      ? [...new Set([0, Math.min(2000, reimbursiveMaxAmount), Math.min(3500, reimbursiveMaxAmount), reimbursiveMaxAmount])]
      : [0];

    for (const seed of seeds) {
      for (const basicDelta of basicDeltas) {
        for (const travelDelta of travelDeltas) {
          for (const retirementDelta of retirementDeltas) {
            const basicPct = this.clamp(seed.basicPct + basicDelta, minBasicPct, 0.85);
            const travelPct = this.clamp(seed.travelPct + travelDelta, 0, maxTravelPct);
            const retirementPct = this.clamp(seed.retirementPct + retirementDelta, 0, 0.20);

            for (const reimbursiveAmount of reimbursiveCandidates) {
              const basicSalary = Math.round(ctc * basicPct);
              const travelAllowance = Math.round(ctc * travelPct);
              const retirementContribution = Math.round(ctc * retirementPct);

              const used = basicSalary + travelAllowance + reimbursiveAmount + medical + retirementContribution;
              const otherAllowanceTaxable = Math.round(ctc - used);

              if (otherAllowanceTaxable < 0) continue;
              if (otherAllowanceTaxable > ctc * 0.10) continue;

              const scenario: CtcScenarioBreakdown = {
                basicSalary,
                travelAllowance,
                reimbursiveTravelNonTaxable: reimbursiveAmount,
                otherAllowanceTaxable,
                otherAllowanceNonTaxable: 0,
                medicalAidEmployerContribution: medical,
                retirementContribution,
              };

              if (!this.isScenarioSane(input, scenario)) continue;

              scenarios.push(scenario);
            }
          }
        }
      }
    }

    return this.dedupAndTrim(scenarios, this.MAX_SCENARIOS);
  }

  private getSeeds(input: RunCtcOptimiserDto): ScenarioSeed[] {
    switch (input.optimisationMode) {
      case 'MAX_NET':
        return [
          { name: 'cash-focused', basicPct: 0.72, travelPct: 0.10, retirementPct: 0.05, reimbursivePct: 0.02 },
          { name: 'high-basic', basicPct: 0.76, travelPct: 0.08, retirementPct: 0.04, reimbursivePct: 0.01 },
          { name: 'balanced-cash', basicPct: 0.68, travelPct: 0.12, retirementPct: 0.06, reimbursivePct: 0.02 },
        ];

      case 'BALANCED':
        return [
          { name: 'balanced', basicPct: 0.65, travelPct: 0.12, retirementPct: 0.08, reimbursivePct: 0.02 },
          { name: 'travel-balanced', basicPct: 0.62, travelPct: 0.15, retirementPct: 0.08, reimbursivePct: 0.03 },
          { name: 'retirement-balanced', basicPct: 0.63, travelPct: 0.10, retirementPct: 0.10, reimbursivePct: 0.02 },
        ];

      case 'TARGET_NET':
      default:
        return [
          { name: 'target-balanced', basicPct: 0.64, travelPct: 0.14, retirementPct: 0.08, reimbursivePct: 0.02 },
          { name: 'travel-leaning', basicPct: 0.60, travelPct: 0.18, retirementPct: 0.07, reimbursivePct: 0.03 },
          { name: 'cash-leaning', basicPct: 0.70, travelPct: 0.10, retirementPct: 0.05, reimbursivePct: 0.02 },
          { name: 'retirement-leaning', basicPct: 0.61, travelPct: 0.10, retirementPct: 0.11, reimbursivePct: 0.02 },
          { name: 'high-basic', basicPct: 0.74, travelPct: 0.08, retirementPct: 0.05, reimbursivePct: 0.01 },
        ];
    }
  }

  private isScenarioSane(input: RunCtcOptimiserDto, scenario: CtcScenarioBreakdown): boolean {
    const ctc = input.ctc;
    const allowanceShare =
      (scenario.travelAllowance +
        scenario.reimbursiveTravelNonTaxable +
        scenario.otherAllowanceTaxable +
        scenario.otherAllowanceNonTaxable) / ctc;
    const basicShare = scenario.basicSalary / ctc;

    if (input.constraints.minBasicPercent && basicShare < input.constraints.minBasicPercent / 100) {
      return false;
    }
    if (input.constraints.maxAllowancePercent && allowanceShare > input.constraints.maxAllowancePercent / 100) {
      return false;
    }
    return true;
  }

  private dedupAndTrim(scenarios: CtcScenarioBreakdown[], limit: number): CtcScenarioBreakdown[] {
    const map = new Map<string, CtcScenarioBreakdown>();
    for (const scenario of scenarios) {
      map.set(JSON.stringify(scenario), scenario);
    }
    return Array.from(map.values()).slice(0, limit);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
