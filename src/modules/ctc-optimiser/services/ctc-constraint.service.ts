import { Injectable } from '@nestjs/common';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import { CtcScenarioBreakdown, CtcConstraintResult } from '../domain/ctc-optimiser.types';

@Injectable()
export class CtcConstraintService {
  validate(input: RunCtcOptimiserDto, scenario: CtcScenarioBreakdown): CtcConstraintResult {
    const warnings: string[] = [];
    const blocks: string[] = [];

    const totalAllowanceShare =
      scenario.travelAllowance +
      scenario.reimbursiveTravelNonTaxable +
      scenario.otherAllowanceTaxable +
      scenario.otherAllowanceNonTaxable;

    const basicPercent = (scenario.basicSalary / input.ctc) * 100;
    const allowancePercent = (totalAllowanceShare / input.ctc) * 100;

    if (input.constraints.minBasicPercent && basicPercent < input.constraints.minBasicPercent) {
      blocks.push(
        `Basic salary is below minimum policy threshold of ${input.constraints.minBasicPercent}%`,
      );
    }

    if (
      input.constraints.maxAllowancePercent &&
      allowancePercent > input.constraints.maxAllowancePercent
    ) {
      blocks.push(
        `Allowance share exceeds maximum policy threshold of ${input.constraints.maxAllowancePercent}%`,
      );
    }

    if (!input.travel.enabled && scenario.travelAllowance > 0) {
      blocks.push('Travel allowance is not permitted for this optimisation input');
    }

    if (!input.reimbursive.enabled && scenario.reimbursiveTravelNonTaxable > 0) {
      blocks.push('Reimbursive travel is not permitted for this optimisation input');
    }

    if (
      input.constraints.requireRetirementFund &&
      (!scenario.retirementContribution || scenario.retirementContribution <= 0)
    ) {
      blocks.push('Retirement contribution is required by policy');
    }

    if (
      input.constraints.requireMedicalAidAsEmployerContribution &&
      scenario.medicalAidEmployerContribution !== input.medicalAid.amount
    ) {
      blocks.push('Medical aid must be structured as employer contribution');
    }

    if (scenario.travelAllowance > 0) {
      warnings.push(
        'Travel allowance requires valid business justification and logbook support.',
      );
    }

    if (scenario.reimbursiveTravelNonTaxable > 0) {
      warnings.push(
        'Reimbursive travel must align to approved claim and reimbursement rules.',
      );
    }

    if (
      input.ctc > 0 &&
      (scenario.retirementContribution / input.ctc) * 100 < 7.5
    ) {
      warnings.push('Retirement contribution is relatively low for long-term sustainability.');
    }

    if (blocks.length > 0) {
      return { status: 'BLOCK', warnings: [...warnings, ...blocks], blocks };
    }

    if (warnings.length > 0) {
      return { status: 'WARN', warnings, blocks: [] };
    }

    return { status: 'PASS', warnings: [], blocks: [] };
  }
}
