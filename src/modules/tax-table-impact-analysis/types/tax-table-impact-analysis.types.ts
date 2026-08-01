export type EmployeeTaxAnalysisBasis = {
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  payGroupId: string | null;
  payGroupName: string | null;
  countryCode: 'ZA' | 'LS';
  age: number | null;

  sourcePayrunId: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  sourcePayDate: string;

  taxRelevantInputs: {
    taxableEarnings: number;
    preTaxDeductions: number;
    fringeBenefits: number;
    retirementDeduction: number;
    medicalCreditDependants: number | null;
    additional: Record<string, unknown>;
  };
};

export type NormalizedDraftTaxTable = {
  id: string;
  countryCode: 'ZA' | 'LS';
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  brackets: Array<{
    seqNo: number;
    fromAmount: number;
    toAmount: number | null;
    rate: number;
    baseTax: number;
    isOpenEnded: boolean;
  }>;
  supplemental: Record<string, unknown>;
};

export type ImpactAnalysisComputeResult = {
  paye: number;
  bracketLabel: string | null;
  warnings: string[];
};

export type ImpactAnalysisPerEmployeeResult = {
  basis: EmployeeTaxAnalysisBasis;
  baseline: ImpactAnalysisComputeResult;
  draft: ImpactAnalysisComputeResult;
  delta: {
    payeAmount: number;
    absoluteAmount: number;
    direction: 'INCREASE' | 'DECREASE' | 'UNCHANGED';
  };
};

export type NormalizedRuntimeTaxTable = {
  id: string;
  taxYear: string;
  brackets: Array<{
    min: number;
    max: number;
    rate: number;
    base_amount: number;
  }>;
  meta: Record<string, any>;
};
