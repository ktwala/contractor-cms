import type { MedicalFundingModel, DisposableIncomeBreakdown } from '../domain/ctc-optimiser.types';

export interface DisposableIncomeInput {
  netPay: number;
  medicalFundingModel?: MedicalFundingModel;
  medicalAmount?: number;
}

/**
 * TDI = Net Pay
 *     + employer-funded benefits that replace personal spending
 *     - personal obligations still payable by the employee
 *
 * v1 scope: medical only.
 */
export function calculateDisposableIncome(
  input: DisposableIncomeInput,
): DisposableIncomeBreakdown & { trueDisposableIncome: number } {
  const medicalAmount = input.medicalAmount ?? 0;
  const fundingModel = input.medicalFundingModel ?? 'EMPLOYER_FUNDED';

  const employerFundedBenefits =
    fundingModel === 'EMPLOYER_FUNDED' ? medicalAmount : 0;

  const personalObligations =
    fundingModel === 'EMPLOYEE_PAID' ? medicalAmount : 0;

  return {
    netPay: input.netPay,
    employerFundedBenefits,
    personalObligations,
    trueDisposableIncome:
      input.netPay + employerFundedBenefits - personalObligations,
  };
}
