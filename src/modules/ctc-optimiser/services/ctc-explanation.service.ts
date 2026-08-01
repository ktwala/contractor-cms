import { Injectable } from '@nestjs/common';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import {
  CtcScenarioBreakdown,
  CtcScenarioEvaluation,
  CtcConstraintResult,
  MedicalFundingModel,
} from '../domain/ctc-optimiser.types';

@Injectable()
export class CtcExplanationService {
  explainScenario(params: {
    input: RunCtcOptimiserDto;
    scenario: CtcScenarioBreakdown;
    evaluation: CtcScenarioEvaluation;
    policy: CtcConstraintResult;
  }): string[] {
    const { input, scenario, evaluation, policy } = params;
    const items: string[] = [];

    items.push(
      `Estimated net pay is R${evaluation.netPay.toFixed(2)} based on the current payroll compute engine.`,
    );

    if (scenario.travelAllowance > 0) {
      items.push(
        'Net pay improves partly because a portion of the package is structured through travel allowance.',
      );
    }

    if (scenario.medicalAidEmployerContribution > 0) {
      const medicalModel = this.resolveMedicalFundingModel(input);
      if (medicalModel === 'EMPLOYER_FUNDED') {
        items.push(
          'True Disposable includes employer-funded medical because it replaces a personal expense without reducing payslip net.',
        );
      } else {
        items.push(
          'This option shows a higher net pay, but medical remains your personal obligation and reduces real disposable income.',
        );
      }
    }

    if (scenario.retirementContribution > 0) {
      items.push(
        'Retirement contribution reduces immediate taxable income but also trades some take-home cash for long-term savings.',
      );
    }

    if (policy.status === 'WARN') {
      items.push(
        'This scenario is usable but includes policy or compliance warnings that should be reviewed before applying.',
      );
    }

    if (input.optimisationMode === 'TARGET_NET' && input.targetNet) {
      const delta = evaluation.netPay - input.targetNet;
      if (Math.abs(delta) <= 1000) {
        items.push('This option lands very close to the requested target net pay.');
      } else if (delta > 0) {
        items.push('This option exceeds the requested target net pay.');
      } else if (delta < -5000) {
        items.push(
          'This option remains materially below the requested target net pay under the current package rules.',
        );
      } else {
        items.push('This option falls below the requested target net pay.');
      }
    }

    return items;
  }

  explainBlockedScenario(policy: CtcConstraintResult): string[] {
    return [
      'This scenario was blocked by policy or configuration constraints.',
      ...(policy.blocks ?? []),
    ];
  }

  private resolveMedicalFundingModel(input: RunCtcOptimiserDto): MedicalFundingModel {
    return (input.medicalAid as any)?.fundingModel ?? 'EMPLOYER_FUNDED';
  }
}
