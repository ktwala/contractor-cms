import api from '../../services/api';

/* ── Simple (advisory) flow types ── */

export type MedicalFundingModel = 'EMPLOYER_FUNDED' | 'EMPLOYEE_PAID';

export interface SimplePackageInput {
  ctc: number;
  targetNet?: number;
  medicalAidAmount: number;
  beneficiaries: number;
  medicalFundingModel?: MedicalFundingModel;
}

export interface SimplePolicyInput {
  allowTravelAllowance: boolean;
  requireRetirementFund: boolean;
  minimumRetirementAmount?: number;
}

export interface SimpleAdvancedConstraints {
  minBasicPercent?: number;
  maxAllowancePercent?: number;
  maxTravelPercent?: number;
  maxReimbursiveAmount?: number;
  requireMedicalAsEmployerContribution?: boolean;
}

export interface RunSimpleCtcOptimiserRequest {
  countryCode: string;
  taxYear: string;
  payFrequency: string;
  legalEntityId?: string;
  employeeId?: string;
  optimisationMode: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';
  packageInput: SimplePackageInput;
  policyInput: SimplePolicyInput;
  advancedConstraints?: SimpleAdvancedConstraints;
}

export interface SimpleCtcBreakdown {
  basicSalary: number;
  travelAllowance: number;
  reimbursiveTravelNonTaxable: number;
  otherAllowanceTaxable: number;
  otherAllowanceNonTaxable: number;
  medicalAidEmployerContribution: number;
  retirementContribution: number;
}

export interface SimpleCtcPayroll {
  grossEarnings: number;
  taxableIncome: number;
  paye: number;
  uif: number;
  netPay: number;
}

export type RecommendationLabel = 'Recommended' | 'Higher Take-Home' | 'Stronger Retirement' | 'Conservative';
export type OutcomeStatus = 'ON_TARGET' | 'CLOSE' | 'BELOW_TARGET' | 'UNREACHABLE_UNDER_RULES';

export interface DisposableIncomeBreakdown {
  netPay: number;
  employerFundedBenefits: number;
  personalObligations: number;
}

export interface SimpleCtcRecommendation {
  label: RecommendationLabel;
  policyStatus: 'PASS' | 'WARN';
  breakdown: SimpleCtcBreakdown;
  payroll: SimpleCtcPayroll;
  trueDisposableIncome: number;
  disposableBreakdown: DisposableIncomeBreakdown;
  explanations: string[];
  warnings: string[];
}

export interface SimpleCtcOptimiserResponse {
  runId: string;
  summary: {
    optimisationMode: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';
    ctc: number;
    targetNet?: number;
    bestAchievedNet: number;
    gapToTarget?: number;
    outcomeStatus: OutcomeStatus;
    medicalFundingModel: MedicalFundingModel;
    medicalAmount: number;
    trueDisposableIncome: number;
    disposableBreakdown: DisposableIncomeBreakdown;
  };
  recommendations: SimpleCtcRecommendation[];
  suggestions: string[];
}

/* ── Legacy advanced flow types (kept for backward compat) ── */

export interface RunCtcOptimiserRequest {
  countryCode: string;
  taxYear: string;
  payFrequency: string;
  legalEntityId?: string;
  employeeId?: string;
  ctc: number;
  optimisationMode: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';
  targetNet?: number;
  medicalAid: { amount: number; beneficiaries: number };
  retirement: { minAmount?: number; targetAmount?: number };
  travel: { enabled: boolean; maxPercent?: number };
  reimbursive: { enabled: boolean; maxAmount?: number };
  constraints: {
    minBasicPercent?: number;
    maxAllowancePercent?: number;
    requireMedicalAidAsEmployerContribution?: boolean;
    requireRetirementFund?: boolean;
  };
}

export interface CtcScenario {
  id: string;
  scenarioCode: string;
  rank: number | null;
  isValid: boolean;
  policyStatus: 'PASS' | 'WARN' | 'BLOCK';
  inputBreakdownJson: SimpleCtcBreakdown;
  payrollOutputJson: {
    taxableIncome: number;
    paye: number;
    uif: number;
    netPay: number;
    grossEarnings: number;
    deductions: number;
    employerCost: number;
  };
  explanationsJson: string[];
  warningsJson: string[];
  scoreTotal: number | null;
  scoreBreakdownJson: {
    netFitScore: number;
    complianceScore: number;
    policyScore: number;
    sustainabilityScore: number;
    simplicityScore: number;
    totalScore: number;
  } | null;
}

export interface CtcOptimiserRun {
  id: string;
  countryCode: string;
  optimisationMode: string;
  status: string;
  selectedScenarioId: string | null;
  createdAt: string;
  scenarios: CtcScenario[];
  decisions: Array<{
    id: string;
    decisionType: string;
    decisionStatus: string;
    decidedAt: string | null;
  }>;
}

/* ── API calls ── */

export async function runSimpleCtcOptimiser(
  payload: RunSimpleCtcOptimiserRequest,
): Promise<SimpleCtcOptimiserResponse> {
  const res = await api.post('/ctc-optimiser/run-simple', payload);
  return res.data?.data ?? res.data;
}

export async function runCtcOptimiser(
  payload: RunCtcOptimiserRequest,
): Promise<CtcOptimiserRun> {
  const res = await api.post('/ctc-optimiser/run', payload);
  return res.data?.data ?? res.data;
}

export async function getCtcOptimiserRun(runId: string): Promise<CtcOptimiserRun> {
  const res = await api.get(`/ctc-optimiser/run/${runId}`);
  return res.data?.data ?? res.data;
}

export async function applyCtcScenario(payload: {
  runId: string;
  scenarioId: string;
  notes?: string;
}): Promise<{ success: boolean }> {
  const res = await api.post('/ctc-optimiser/apply', payload);
  return res.data?.data ?? res.data;
}
