import { calculateDisposableIncome } from '../services/ctc-disposable-income.calculator';

describe('calculateDisposableIncome', () => {
  it('employer-funded medical adds to TDI', () => {
    const result = calculateDisposableIncome({
      netPay: 61000,
      medicalFundingModel: 'EMPLOYER_FUNDED',
      medicalAmount: 15000,
    });
    expect(result.trueDisposableIncome).toBe(76000);
    expect(result.employerFundedBenefits).toBe(15000);
    expect(result.personalObligations).toBe(0);
    expect(result.netPay).toBe(61000);
  });

  it('employee-paid medical subtracts from TDI', () => {
    const result = calculateDisposableIncome({
      netPay: 80000,
      medicalFundingModel: 'EMPLOYEE_PAID',
      medicalAmount: 15000,
    });
    expect(result.trueDisposableIncome).toBe(65000);
    expect(result.employerFundedBenefits).toBe(0);
    expect(result.personalObligations).toBe(15000);
    expect(result.netPay).toBe(80000);
  });

  it('zero medical amount yields TDI equal to net pay', () => {
    const result = calculateDisposableIncome({
      netPay: 70000,
      medicalFundingModel: 'EMPLOYER_FUNDED',
      medicalAmount: 0,
    });
    expect(result.trueDisposableIncome).toBe(70000);
    expect(result.employerFundedBenefits).toBe(0);
    expect(result.personalObligations).toBe(0);
  });

  it('undefined funding model defaults to EMPLOYER_FUNDED', () => {
    const result = calculateDisposableIncome({
      netPay: 61000,
      medicalAmount: 15000,
    });
    expect(result.trueDisposableIncome).toBe(76000);
    expect(result.employerFundedBenefits).toBe(15000);
  });

  it('undefined medical amount defaults to zero', () => {
    const result = calculateDisposableIncome({
      netPay: 70000,
      medicalFundingModel: 'EMPLOYEE_PAID',
    });
    expect(result.trueDisposableIncome).toBe(70000);
    expect(result.personalObligations).toBe(0);
  });

  it('employer-funded: lower net + TDI boost vs employee-paid: higher net + TDI penalty', () => {
    const employer = calculateDisposableIncome({
      netPay: 61000,
      medicalFundingModel: 'EMPLOYER_FUNDED',
      medicalAmount: 15000,
    });
    const employee = calculateDisposableIncome({
      netPay: 76000,
      medicalFundingModel: 'EMPLOYEE_PAID',
      medicalAmount: 15000,
    });

    expect(employer.trueDisposableIncome).toBe(76000);
    expect(employee.trueDisposableIncome).toBe(61000);
    expect(employer.trueDisposableIncome).toBeGreaterThan(employee.trueDisposableIncome);
  });
});
