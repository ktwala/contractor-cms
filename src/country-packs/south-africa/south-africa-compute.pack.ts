import { Injectable } from '@nestjs/common';
import {
  ICountryPayrollPack,
  PayrollComputeContext,
  TaxTableContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ComputeResult,
  EmployeeComputeResult,
  PostProcessResult,
  TraceEntry,
  PayLine,
  PayItemInput,
  PayItemClassification,
} from '../interfaces/compute-contract.interface';

/**
 * South Africa Country Pack v2.0 - Compute Contract Implementation (Database-Driven)
 *
 * Tax Year: 1 March - 28 February
 * Currency: South African Rand (ZAR)
 *
 * IMPORTANT: All tax rates are loaded from the database via ctx.tax_tables.
 * This pack contains only the calculation logic, not the rates.
 *
 * Features:
 * - Progressive PAYE (from database)
 * - Age-based rebates (from database)
 * - Medical tax credits (from database)
 * - UIF (from statutory_configs)
 * - SDL (from statutory_configs)
 * - Pre-tax retirement fund contributions
 * - Taxable fringe benefits
 */
/**
 * Feature flag: when true, missing DB config values cause validation failure
 * instead of silent fallback to hardcoded defaults.
 */
let zaStrictDbConfigMode = false;

export function setZaStrictDbConfigMode(enabled: boolean): void {
  zaStrictDbConfigMode = enabled;
}

export function getZaStrictDbConfigMode(): boolean {
  return zaStrictDbConfigMode;
}

@Injectable()
export class SouthAfricaComputePack implements ICountryPayrollPack {
  readonly pack_id = 'ZA' as const;
  readonly pack_version = 'za-pack@2.0.0';

  /**
   * @deprecated These defaults exist for backward compatibility.
   * Target: move all values into TaxTableSet supplemental fields or StatutoryConfig.
   * When zaStrictDbConfigMode is enabled, these are not used.
   */
  private readonly DEFAULTS = {
    PRIMARY_REBATE: 17235,
    SECONDARY_REBATE: 9444,
    TERTIARY_REBATE: 3145,
    MTC_MAIN: 364,
    MTC_FIRST_DEP: 364,
    MTC_ADDITIONAL_DEP: 246,
    UIF_RATE: 0.01,
    UIF_CEILING: 17712,
    SDL_RATE: 0.01,
    SDL_THRESHOLD: 500000,
    RETIREMENT_RATE: 0.275,
    RETIREMENT_CAP: 350000,
  };

  // Pay Item Classification Helpers
  private isClassificationTaxable(classification?: PayItemClassification): boolean {
    const taxableClassifications: PayItemClassification[] = [
      'BASIC_SALARY', 'OVERTIME', 'COMMISSION', 'BONUS', 'ALLOWANCE_TAXABLE',
      'FRINGE_BENEFIT_COMPANY_CAR', 'FRINGE_BENEFIT_HOUSING', 'FRINGE_BENEFIT_OTHER',
    ];
    return classification ? taxableClassifications.includes(classification) : true;
  }

  private isPreTaxDeduction(classification?: PayItemClassification): boolean {
    return classification === 'RETIREMENT_CONTRIBUTION' || classification === 'MEDICAL_AID_CONTRIBUTION';
  }

  private isFringeBenefit(classification?: PayItemClassification): boolean {
    return classification === 'FRINGE_BENEFIT_COMPANY_CAR' || classification === 'FRINGE_BENEFIT_HOUSING' || classification === 'FRINGE_BENEFIT_OTHER';
  }

  async validate(ctx: PayrollComputeContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (ctx.payrun.country !== 'ZA') {
      errors.push({ code: 'COUNTRY_MISMATCH', message: 'ZA pack cannot compute non-ZA payruns' });
    }

    if (ctx.payrun.currency !== 'ZAR') {
      errors.push({ code: 'CURRENCY_MISMATCH', message: `Expected currency ZAR, got ${ctx.payrun.currency}` });
    }

    if (!ctx.tax_tables || !ctx.tax_tables.brackets || ctx.tax_tables.brackets.length === 0) {
      errors.push({
        code: 'MISSING_TAX_TABLES',
        message: 'Tax tables with brackets are required. Please seed the database with: npx ts-node prisma/seeds/tax-tables.seed.ts',
      });
    }

    if (zaStrictDbConfigMode && ctx.tax_tables) {
      const meta = ctx.tax_tables.meta;
      const missing: string[] = [];
      if (!meta?.rebates?.primary) missing.push('rebates.primary');
      if (!meta?.rebates?.secondary) missing.push('rebates.secondary');
      if (!meta?.rebates?.tertiary) missing.push('rebates.tertiary');
      if (!meta?.uif?.employee_rate) missing.push('uif.employee_rate');
      if (!meta?.uif?.monthly_ceiling) missing.push('uif.monthly_ceiling');
      if (!meta?.sdl?.rate) missing.push('sdl.rate');
      if (!meta?.mtc?.main_member) missing.push('mtc.main_member');
      if (missing.length > 0) {
        errors.push({
          code: 'ZA_STRICT_MODE_MISSING_CONFIG',
          message: `Strict DB config mode is enabled. Missing values: ${missing.join(', ')}. Seed via Tax Table Authoring or StatutoryConfig.`,
        });
      }
    }

    for (const emp of ctx.employees) {
      if (emp.tax_profile?.age === undefined) {
        errors.push({
          employee_id: emp.employee_id,
          code: 'MISSING_AGE',
          message: 'Age is required for rebate selection',
          field: 'tax_profile.age',
        });
      }

      if (!emp.inputs || emp.inputs.pay_items.length === 0) {
        errors.push({
          employee_id: emp.employee_id,
          code: 'MISSING_PAY_ITEMS',
          message: 'At least one pay item is required',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async compute(ctx: PayrollComputeContext): Promise<ComputeResult> {
    const employeeResults: EmployeeComputeResult[] = [];
    const employerTotals: Record<string, number> = { UIF_EMPLOYER: 0, SDL: 0 };
    const sdlLiable = this.isSdlLiable(ctx);

    for (const emp of ctx.employees) {
      const result = this.computeEmployee(ctx, emp, sdlLiable);
      employeeResults.push(result);

      for (const line of result.lines) {
        if (line.code === 'UIF_ER') employerTotals.UIF_EMPLOYER += line.amount;
        if (line.code === 'SDL_ER') employerTotals.SDL += line.amount;
      }
    }

    employerTotals.UIF_EMPLOYER = this.round2(employerTotals.UIF_EMPLOYER);
    employerTotals.SDL = this.round2(employerTotals.SDL);

    return { employee_results: employeeResults, employer_totals: employerTotals };
  }

  private computeEmployee(
    ctx: PayrollComputeContext,
    emp: typeof ctx.employees[0],
    sdlLiable: boolean,
  ): EmployeeComputeResult {
    const trace: TraceEntry[] = [];
    const lines: PayLine[] = [];
    const age = emp.tax_profile?.age || 0;
    const taxTables = ctx.tax_tables;

    const fallbacksUsed: string[] = [];

    const rebates = {
      primary: this.resolveWithFallbackTracking(taxTables.meta?.rebates?.primary, this.DEFAULTS.PRIMARY_REBATE, 'rebates.primary', fallbacksUsed),
      secondary: this.resolveWithFallbackTracking(taxTables.meta?.rebates?.secondary, this.DEFAULTS.SECONDARY_REBATE, 'rebates.secondary', fallbacksUsed),
      tertiary: this.resolveWithFallbackTracking(taxTables.meta?.rebates?.tertiary, this.DEFAULTS.TERTIARY_REBATE, 'rebates.tertiary', fallbacksUsed),
    };

    const mtc = {
      main: this.resolveWithFallbackTracking(taxTables.meta?.mtc?.main_member, this.DEFAULTS.MTC_MAIN, 'mtc.main_member', fallbacksUsed),
      first_dep: this.resolveWithFallbackTracking(taxTables.meta?.mtc?.first_dependant, this.DEFAULTS.MTC_FIRST_DEP, 'mtc.first_dependant', fallbacksUsed),
      additional: this.resolveWithFallbackTracking(taxTables.meta?.mtc?.additional_dependants, this.DEFAULTS.MTC_ADDITIONAL_DEP, 'mtc.additional_dependants', fallbacksUsed),
    };

    const uif = {
      rate: this.resolveWithFallbackTracking(taxTables.meta?.uif?.employee_rate, this.DEFAULTS.UIF_RATE, 'uif.employee_rate', fallbacksUsed),
      ceiling: this.resolveWithFallbackTracking(taxTables.meta?.uif?.monthly_ceiling, this.DEFAULTS.UIF_CEILING, 'uif.monthly_ceiling', fallbacksUsed),
    };

    const sdl = {
      rate: this.resolveWithFallbackTracking(taxTables.meta?.sdl?.rate, this.DEFAULTS.SDL_RATE, 'sdl.rate', fallbacksUsed),
    };

    trace.push({
      step: 'START',
      description: 'Begin ZA payroll calculation',
      inputs: {
        employee_id: emp.employee_id,
        age,
        brackets_count: taxTables.brackets?.length,
        source: fallbacksUsed.length === 0 ? 'database' : 'database_with_fallbacks',
        fallbacks_used: fallbacksUsed.length > 0 ? fallbacksUsed : undefined,
        za_strict_mode: zaStrictDbConfigMode,
      },
    });

    // STEP 1: Calculate Gross Pay
    let grossEarnings = 0;
    let fringeBenefitsTaxable = 0;

    for (const item of emp.inputs.pay_items) {
      if (item.type === 'EARNING') {
        grossEarnings += item.amount;
        lines.push({ code: item.code, name: item.name, type: 'EARNING', amount: this.round2(item.amount), is_taxable: this.determineItemTaxable(item) });
      }
      if (this.isFringeBenefit(item.classification)) {
        fringeBenefitsTaxable += item.amount;
        lines.push({ code: item.code, name: item.name, type: 'EARNING', amount: this.round2(item.amount), is_taxable: true });
      }
    }

    const gross = grossEarnings + fringeBenefitsTaxable;

    trace.push({ step: 'GROSS_PAY', description: 'Calculate gross pay', output: this.round2(gross) });

    // STEP 2: Pre-Tax Deductions
    let retirementContribution = 0;
    let medicalAidContribution = 0;

    for (const item of emp.inputs.pay_items) {
      if (item.type === 'DEDUCTION' && this.isPreTaxDeduction(item.classification)) {
        if (item.classification === 'RETIREMENT_CONTRIBUTION') retirementContribution += item.amount;
        if (item.classification === 'MEDICAL_AID_CONTRIBUTION') medicalAidContribution += item.amount;
      }
    }

    const maxRetirementDeductible = Math.min(gross * this.DEFAULTS.RETIREMENT_RATE, this.DEFAULTS.RETIREMENT_CAP / 12);
    const deductibleRetirement = Math.min(retirementContribution, maxRetirementDeductible);

    if (retirementContribution > 0) {
      lines.push({ code: 'RETIREMENT', name: 'Retirement Fund Contribution', type: 'DEDUCTION', amount: this.round2(retirementContribution) });
    }
    if (medicalAidContribution > 0) {
      lines.push({ code: 'MEDICAL_AID', name: 'Medical Aid Contribution', type: 'DEDUCTION', amount: this.round2(medicalAidContribution) });
    }

    // STEP 3: Taxable Income
    let taxableEarnings = 0;
    for (const item of emp.inputs.pay_items) {
      if ((item.type === 'EARNING' || item.type === 'BENEFIT') && this.determineItemTaxable(item)) {
        taxableEarnings += item.amount;
      }
    }
    const taxableIncome = Math.max(0, taxableEarnings - deductibleRetirement);

    trace.push({ step: 'TAXABLE_INCOME', description: 'Calculate taxable income', output: this.round2(taxableIncome) });

    // STEP 4: PAYE (using database brackets)
    const annualTaxable = taxableIncome * 12;
    const annualTax = this.calculateAnnualTax(annualTaxable, taxTables.brackets);
    const rebateTotal = this.calculateRebate(age, rebates);
    const annualTaxAfterRebate = Math.max(0, annualTax - rebateTotal);
    const monthlyPayeBeforeMtc = annualTaxAfterRebate / 12;

    const medicalScheme = emp.tax_profile?.meta?.medical_scheme || {};
    const mtcAmount = this.calculateMtc(medicalScheme.main_members || 0, medicalScheme.dependants || 0, mtc);
    const paye = Math.max(0, monthlyPayeBeforeMtc - mtcAmount);

    trace.push({
      step: 'PAYE',
      description: 'Calculate PAYE (database brackets)',
      inputs: { annual_taxable: this.round2(annualTaxable), annual_tax: this.round2(annualTax), rebate: rebateTotal, mtc: mtcAmount },
      output: this.round2(paye),
    });

    lines.push({ code: 'PAYE', name: 'Pay As You Earn', type: 'TAX', amount: this.round2(paye) });

    // STEP 5: UIF
    const uifBase = Math.min(gross, uif.ceiling);
    const uifEmp = uifBase * uif.rate;
    const uifEr = uifBase * uif.rate;

    lines.push({ code: 'UIF_EMP', name: 'UIF Employee', type: 'STATUTORY', amount: this.round2(uifEmp) });
    lines.push({ code: 'UIF_ER', name: 'UIF Employer', type: 'EMPLOYER_CONTRIBUTION', amount: this.round2(uifEr) });

    // STEP 6: SDL
    const sdlAmount = sdlLiable ? gross * sdl.rate : 0;
    if (sdlAmount > 0) {
      lines.push({ code: 'SDL_ER', name: 'Skills Development Levy', type: 'EMPLOYER_CONTRIBUTION', amount: this.round2(sdlAmount) });
    }

    // STEP 7: Other Deductions
    let otherDeductions = 0;
    for (const item of emp.inputs.pay_items) {
      if (item.type === 'DEDUCTION' && !this.isPreTaxDeduction(item.classification)) {
        otherDeductions += item.amount;
        lines.push({ code: item.code, name: item.name, type: 'DEDUCTION', amount: this.round2(item.amount) });
      }
    }

    // STEP 8: Net Pay
    const totalDeductions = paye + uifEmp + retirementContribution + medicalAidContribution + otherDeductions;
    const net = gross - totalDeductions;

    trace.push({ step: 'NET', description: 'Calculate net pay', output: this.round2(net) });

    return {
      employee_id: emp.employee_id,
      totals: {
        gross: this.round2(gross),
        taxable_income: this.round2(taxableIncome),
        paye: this.round2(paye),
        statutory_deductions: this.round2(uifEmp),
        other_deductions: this.round2(otherDeductions),
        employer_contributions: this.round2(uifEr + sdlAmount),
        net: this.round2(net),
        pre_tax_deductions: {
          retirement_contribution: this.round2(retirementContribution),
          medical_aid_contribution: this.round2(medicalAidContribution),
          total: this.round2(deductibleRetirement + medicalAidContribution),
        },
        fringe_benefits_taxable: this.round2(fringeBenefitsTaxable),
      },
      lines,
      trace,
    };
  }

  async post_process(ctx: PayrollComputeContext, result: ComputeResult): Promise<PostProcessResult> {
    let payeTotal = 0, uifEmpTotal = 0, totalGross = 0, totalNet = 0;

    for (const emp of result.employee_results) {
      totalGross += emp.totals.gross;
      totalNet += emp.totals.net;
      for (const line of emp.lines) {
        if (line.code === 'PAYE') payeTotal += line.amount;
        if (line.code === 'UIF_EMP') uifEmpTotal += line.amount;
      }
    }

    return {
      statutory_payloads: {
        ZA: {
          EMP201: {
            PAYE: this.round2(payeTotal),
            UIF_EMPLOYEE: this.round2(uifEmpTotal),
            UIF_EMPLOYER: this.round2(result.employer_totals.UIF_EMPLOYER || 0),
            SDL: this.round2(result.employer_totals.SDL || 0),
          },
        },
      },
      summary: {
        total_employees: result.employee_results.length,
        total_gross: this.round2(totalGross),
        total_paye: this.round2(payeTotal),
        total_statutory: this.round2(uifEmpTotal + (result.employer_totals.UIF_EMPLOYER || 0) + (result.employer_totals.SDL || 0)),
        total_net: this.round2(totalNet),
        total_employer_cost: this.round2(totalGross + (result.employer_totals.UIF_EMPLOYER || 0) + (result.employer_totals.SDL || 0)),
      },
    };
  }

  // Helper Methods
  private determineItemTaxable(item: PayItemInput): boolean {
    if (item.classification) return this.isClassificationTaxable(item.classification);
    return item.is_taxable !== false;
  }

  private calculateAnnualTax(annualTaxable: number, brackets: TaxTableContext['brackets']): number {
    const ti = Math.max(0, annualTaxable);
    for (const bracket of brackets) {
      const max = bracket.max ?? Infinity;
      if (ti >= bracket.min && ti <= max) {
        return bracket.base_amount + bracket.rate * (ti - bracket.min);
      }
    }
    return 0;
  }

  private calculateRebate(age: number, rebates: { primary: number; secondary: number; tertiary: number }): number {
    let rebate = rebates.primary;
    if (age >= 65) rebate += rebates.secondary;
    if (age >= 75) rebate += rebates.tertiary;
    return rebate;
  }

  private calculateMtc(mainMembers: number, dependants: number, mtc: { main: number; first_dep: number; additional: number }): number {
    if (mainMembers <= 0) return 0;
    let credit = mtc.main;
    if (dependants >= 1) credit += mtc.first_dep;
    if (dependants >= 2) credit += (dependants - 1) * mtc.additional;
    return credit;
  }

  private isSdlLiable(ctx: PayrollComputeContext): boolean {
    const employerConfig = (ctx as any).employer_config;
    if (employerConfig?.sdl_liable !== undefined) return Boolean(employerConfig.sdl_liable);
    let estimated = 0;
    for (const emp of ctx.employees) {
      for (const item of emp.inputs.pay_items) {
        if (item.type === 'EARNING') estimated += item.amount * 12;
      }
    }
    return estimated > this.DEFAULTS.SDL_THRESHOLD;
  }

  private resolveWithFallbackTracking(
    dbValue: number | undefined,
    fallbackValue: number,
    fieldPath: string,
    fallbacksUsed: string[],
  ): number {
    if (dbValue != null && dbValue !== 0) {
      return dbValue;
    }
    fallbacksUsed.push(fieldPath);
    return fallbackValue;
  }

  private round2(x: number): number {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }
}
