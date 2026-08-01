export type BlockingReasonCode =
  | 'NO_PERIODS'
  | 'NO_ELIGIBLE_EMPLOYEES'
  | 'MISSING_COMPENSATION'
  | 'MISSING_BANK_ACCOUNTS'
  | 'MISSING_TAX_IDENTITY'
  | 'MISSING_TAX_NUMBERS'
  | 'MISSING_PAYROLL_ELIGIBILITY'
  | 'OPENING_BALANCES_REQUIRED'
  | 'MISSING_WORKFORCE'
  | 'MISSING_COMPUTE_PACK'
  | 'MISSING_PAYE_TAX_TABLE'
  | 'INCOMPLETE_STATUTORY_BOOTSTRAP';

export type NextRecommendedAction =
  | 'FIX_WORKFORCE'
  | 'IMPORT_PAYROLL_SUPPLEMENTAL'
  | 'IMPORT_OPENING_BALANCES'
  | 'GENERATE_PERIODS'
  | 'FIX_PAYROLL_ELIGIBILITY'
  | 'STATUTORY_BOOTSTRAP'
  | 'CREATE_PAYRUN';

export interface BlockingReason {
  code: BlockingReasonCode;
  message: string;
}

export interface PayrollReadinessResponse {
  payGroupId: string;
  payGroupCode: string;
  countryCode: string;
  currencyCode: string;
  frequency: string;
  readinessPercent: number;
  workforceImported: boolean;
  payrollSupplementalReady: boolean;
  openingBalancesRequired: boolean;
  openingBalancesLoaded: boolean;
  periodsGenerated: boolean;
  eligibleEmployeeCount: number;
  missingBankCount: number;
  missingTaxIdentityCount: number;
  missingTaxNumberCount: number;
  missingCompensationCount: number;
  missingEligibilityCount: number;
  canCreatePayrun: boolean;
  blockingReasons: BlockingReason[];
  nextRecommendedAction: NextRecommendedAction;
  /** Present for ZA/LS pay groups: pack + PAYE + ZA statutory snapshot inputs (as-of today UTC). */
  statutoryBootstrap?: {
    asOf: string;
    countryCode: string;
    packRegistryReady: boolean;
    payeTaxTableReady: boolean;
    statutoryConfigsReady: boolean;
    snapshotEngineReady: boolean;
    operatorBootstrapComplete: boolean;
  } | null;
}
