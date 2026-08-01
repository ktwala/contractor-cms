import { Decimal } from 'decimal.js';

export interface TaxCalculationInput {
  grossIncome: Decimal;
  taxableIncome: Decimal;
  annualEquivalent: Decimal;
  employeeAge?: number;
  taxProfile?: {
    tax_number?: string;
    tax_status?: string;
    meta?: Record<string, any>;
  };
  payPeriodType: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
  isFirstPayrun?: boolean;
  ytdTaxableIncome?: Decimal;
  ytdPaye?: Decimal;

  // Database-driven tax table data (injected by PackRouterService)
  taxTableData?: {
    brackets: Array<{
      min: number;
      max: number | null;
      rate: number;
      base_amount: number;
    }>;
    credits?: {
      tax_credit?: number;
    };
    rebates?: {
      primary?: number;
      secondary?: number;
      tertiary?: number;
    };
    thresholds?: {
      under65?: number;
      age65to74?: number;
      age75plus?: number;
    };
    periods_per_year?: Record<string, number>;
  };
}

export interface TaxCalculationResult {
  paye: Decimal;
  additionalTaxes: AdditionalTax[];
  trace: TaxTraceEntry[];
}

export interface AdditionalTax {
  code: string;
  name: string;
  amount: Decimal;
  employeeContribution: Decimal;
  employerContribution: Decimal;
  trace?: Record<string, any>;
}

export interface TaxTraceEntry {
  step: string;
  description: string;
  input?: any;
  output?: any;
  formula?: string;
}

export interface DeductionCalculationInput {
  grossIncome: Decimal;
  employeeData: {
    id: string;
    age?: number;
    taxProfile?: Record<string, any>;
    employment?: Record<string, any>;
  };
  payrunContext: {
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
  };
}

export interface DeductionResult {
  code: string;
  name: string;
  amount: Decimal;
  isStatutory: boolean;
  employeeContribution: Decimal;
  employerContribution: Decimal;
  trace?: Record<string, any>;
}

export interface StatutoryExportFormat {
  formatId: string;
  name: string;
  description: string;
  fileExtension: string;
}

export interface ExportGenerationInput {
  payrunId: string;
  formatId: string;
  employeeResults: any[];
  legalEntity: any;
  payPeriod: any;
}

export interface CountryPackMetadata {
  countryCode: string;
  countryName: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  taxYearStart: { month: number; day: number };
  taxYearEnd: { month: number; day: number };
  version: string;
}

export interface ICountryPack {
  readonly metadata: CountryPackMetadata;

  /**
   * Calculate PAYE and other income taxes
   */
  calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult>;

  /**
   * Calculate statutory deductions (UIF, SDL, pension, etc.)
   */
  calculateStatutoryDeductions(input: DeductionCalculationInput): Promise<DeductionResult[]>;

  /**
   * Get available statutory export formats for this country
   */
  getStatutoryExportFormats(): StatutoryExportFormat[];

  /**
   * Generate statutory export file content
   */
  generateStatutoryExport(input: ExportGenerationInput): Promise<Buffer | string>;

  /**
   * Validate tax number format for this country
   */
  validateTaxNumber(taxNumber: string): { valid: boolean; message?: string };

  /**
   * Get periods per year based on pay period type
   */
  getPeriodsPerYear(periodType: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY'): number;

  /**
   * Calculate age-based rebates or credits (if applicable)
   */
  calculateAgeRebate?(age: number, taxYear: number): Decimal;
}
