export type CtcOptimisationMode = 'MAX_NET' | 'TARGET_NET' | 'BALANCED';
export type MedicalFundingModel = 'EMPLOYER_FUNDED' | 'EMPLOYEE_PAID';
export type CtcPolicyStatus = 'PASS' | 'WARN' | 'BLOCK';
export type CtcRunStatus = 'COMPLETED' | 'PENDING_APPROVAL' | 'APPROVED' | 'APPLIED' | 'FAILED';
export type CtcDecisionType = 'SELECT' | 'APPROVE' | 'REJECT' | 'APPLY';
export type CtcDecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';

export interface CtcScenarioBreakdown {
  basicSalary: number;
  travelAllowance: number;
  reimbursiveTravelNonTaxable: number;
  otherAllowanceTaxable: number;
  otherAllowanceNonTaxable: number;
  medicalAidEmployerContribution: number;
  retirementContribution: number;
}

export interface CtcScenarioScoreBreakdown {
  netFitScore: number;
  complianceScore: number;
  policyScore: number;
  sustainabilityScore: number;
  simplicityScore: number;
  totalScore: number;
}

export interface CtcScenarioEvaluation {
  taxableIncome: number;
  paye: number;
  uif: number;
  netPay: number;
  grossEarnings: number;
  deductions: number;
  employerCost: number;
  creditsApplied?: Record<string, number>;
  engineOutput: Record<string, unknown>;
}

export interface CtcConstraintResult {
  status: CtcPolicyStatus;
  warnings: string[];
  blocks: string[];
}

export interface CtcEvaluatedScenario {
  scenario: CtcScenarioBreakdown;
  policy: CtcConstraintResult;
  evaluation: CtcScenarioEvaluation | null;
  explanations: string[];
  warnings: string[];
  score?: CtcScenarioScoreBreakdown | null;
  rank?: number | null;
  checksum?: string;
}

export type CtcOutcomeStatus = 'ON_TARGET' | 'CLOSE' | 'BELOW_TARGET' | 'UNREACHABLE_UNDER_RULES';
export type CtcRecommendationLabel = 'Recommended' | 'Higher Take-Home' | 'Stronger Retirement' | 'Conservative';

export interface DisposableIncomeBreakdown {
  netPay: number;
  employerFundedBenefits: number;
  personalObligations: number;
}

export interface SimpleCtcOptimiserSummary {
  optimisationMode: CtcOptimisationMode;
  ctc: number;
  targetNet?: number;
  bestAchievedNet: number;
  gapToTarget?: number;
  outcomeStatus: CtcOutcomeStatus;
  medicalFundingModel: MedicalFundingModel;
  medicalAmount: number;
  trueDisposableIncome: number;
  disposableBreakdown: DisposableIncomeBreakdown;
}

export interface SimpleCtcRecommendation {
  label: CtcRecommendationLabel;
  policyStatus: 'PASS' | 'WARN';
  breakdown: CtcScenarioBreakdown;
  payroll: {
    grossEarnings: number;
    taxableIncome: number;
    paye: number;
    uif: number;
    netPay: number;
  };
  trueDisposableIncome: number;
  disposableBreakdown: DisposableIncomeBreakdown;
  explanations: string[];
  warnings: string[];
}

export interface SimpleCtcOptimiserResponse {
  runId: string;
  summary: SimpleCtcOptimiserSummary;
  recommendations: SimpleCtcRecommendation[];
  suggestions: string[];
}

export interface PayrollSimulationBridgeInput {
  country: string;
  legalEntityId?: string;
  employeeId?: string;
  payDate: string;
  periodEnd: string;
  earnings: Array<{ code: string; amount: number }>;
  deductions: Array<{ code: string; amount: number }>;
  routing: Record<string, unknown>;
}

export interface PayrollSimulationBridgeOutput {
  taxableIncome: number;
  paye: number;
  uif: number;
  netPay: number;
  grossEarnings: number;
  totalDeductions: number;
  employerCost: number;
  taxCredits?: Record<string, number>;
  details?: Record<string, unknown>;
}
