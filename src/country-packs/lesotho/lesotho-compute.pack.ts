import { Injectable } from '@nestjs/common';
import {
  ICountryPayrollPack,
  PayrollComputeContext,
  TaxTableContext,
  ValidationResult,
  ValidationError,
  ComputeResult,
  EmployeeComputeResult,
  PostProcessResult,
  TraceEntry,
  PayLine,
} from '../interfaces/compute-contract.interface';

/**
 * Lesotho Country Pack - Compute Contract Implementation
 *
 * Tax Year: April 1 - March 31
 * Currency: Lesotho Loti (LSL)
 *
 * Features:
 * - Progressive PAYE tax brackets (from database)
 * - Tax credits system (from database)
 * - No UIF or SDL (South African specific)
 * 
 * IMPORTANT: Tax brackets and credits are loaded from the database via tax_tables context.
 * This pack contains only the calculation logic, not the rates themselves.
 */
@Injectable()
export class LesothoComputePack implements ICountryPayrollPack {
  readonly pack_id = 'LS' as const;
  readonly pack_version = 'ls-pack@2025.1';

  async validate(ctx: PayrollComputeContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Validate country
    if (ctx.payrun.country !== 'LS') {
      errors.push({
        code: 'INVALID_COUNTRY',
        message: `Expected country LS, got ${ctx.payrun.country}`,
      });
    }

    // Validate currency
    if (ctx.payrun.currency !== 'LSL') {
      errors.push({
        code: 'INVALID_CURRENCY',
        message: `Expected currency LSL, got ${ctx.payrun.currency}`,
      });
    }

    // Validate tax tables exist (REQUIRED - no fallbacks)
    if (!ctx.tax_tables || !ctx.tax_tables.brackets || ctx.tax_tables.brackets.length === 0) {
      errors.push({
        code: 'MISSING_TAX_TABLES',
        message: 'Tax tables with brackets are required. Please seed the database with: npx ts-node prisma/seeds/tax-tables.seed.ts',
      });
    }

    // Validate each employee
    for (const emp of ctx.employees) {
      if (!emp.inputs || emp.inputs.pay_items.length === 0) {
        errors.push({
          employee_id: emp.employee_id,
          code: 'MISSING_PAY_ITEMS',
          message: 'At least one pay item is required',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async compute(ctx: PayrollComputeContext): Promise<ComputeResult> {
    const employeeResults: EmployeeComputeResult[] = [];
    const employerTotals: Record<string, number> = {};

    for (const emp of ctx.employees) {
      const result = this.computeEmployee(ctx, emp);
      employeeResults.push(result);
    }

    return {
      employee_results: employeeResults,
      employer_totals: employerTotals,
    };
  }

  private computeEmployee(
    ctx: PayrollComputeContext,
    emp: typeof ctx.employees[0],
  ): EmployeeComputeResult {
    const trace: TraceEntry[] = [];
    const lines: PayLine[] = [];

    // Get tax tables from context (database-driven)
    const taxTables = ctx.tax_tables;

    trace.push({
      step: 'START',
      description: 'Begin Lesotho payroll calculation (database-driven tax tables)',
      inputs: {
        employee_id: emp.employee_id,
        pay_items_count: emp.inputs.pay_items.length,
        tax_credit: taxTables.meta?.tax_credit,
        brackets_count: taxTables.brackets?.length,
      },
    });

    // Step 1: Calculate gross pay
    let gross = 0;
    const earningsInputs: Record<string, number> = {};

    for (const item of emp.inputs.pay_items) {
      if (item.type === 'EARNING' || item.type === 'BENEFIT' || item.type === 'REIMBURSEMENT') {
        gross += item.amount;
        earningsInputs[item.code] = item.amount;

        lines.push({
          code: item.code,
          name: item.name,
          type: 'EARNING',
          amount: item.amount,
          is_taxable: item.is_taxable !== false,
        });
      }
    }

    trace.push({
      step: 'GROSS_PAY',
      description: 'Sum all earnings',
      inputs: earningsInputs,
      output: gross,
    });

    // Step 2: Calculate taxable income
    let taxableIncome = 0;
    for (const item of emp.inputs.pay_items) {
      if ((item.type === 'EARNING' || item.type === 'BENEFIT') && item.is_taxable !== false) {
        taxableIncome += item.amount;
      }
    }

    // Subtract pre-tax deductions
    for (const item of emp.inputs.pay_items) {
      if (item.type === 'DEDUCTION' && item.meta?.pre_tax) {
        taxableIncome -= item.amount;
      }
    }

    trace.push({
      step: 'TAXABLE_INCOME',
      description: 'Calculate taxable income (gross less pre-tax deductions)',
      inputs: { gross, pre_tax_deductions: gross - taxableIncome },
      output: taxableIncome,
    });

    // Step 3: Calculate PAYE using database-driven tax tables
    const periodsPerYear = this.getPeriodsPerYear(ctx.payrun.period.period_type);
    const paye = this.calculatePAYE(taxableIncome, taxTables, periodsPerYear, trace);

    lines.push({
      code: 'PAYE',
      name: 'Pay As You Earn',
      type: 'TAX',
      amount: paye,
      trace: { method: 'annual_equivalent', source: 'database' },
    });

    // Step 4: Process deductions
    let totalDeductions = paye;
    for (const item of emp.inputs.pay_items) {
      if (item.type === 'DEDUCTION') {
        totalDeductions += item.amount;
        lines.push({
          code: item.code,
          name: item.name,
          type: 'DEDUCTION',
          amount: item.amount,
        });
      }
    }

    // Step 5: Calculate net pay
    const net = this.round(gross - totalDeductions, ctx.rounding_policy);

    trace.push({
      step: 'NET_PAY',
      description: 'Calculate net pay',
      formula: `${gross} - ${totalDeductions}`,
      output: net,
    });

    trace.push({
      step: 'COMPLETE',
      description: 'Lesotho payroll calculation complete',
      output: {
        gross,
        taxable_income: taxableIncome,
        paye,
        total_deductions: totalDeductions,
        net,
      },
    });

    return {
      employee_id: emp.employee_id,
      totals: {
        gross,
        taxable_income: taxableIncome,
        paye,
        statutory_deductions: 0, // Lesotho has no UIF/SDL
        other_deductions: totalDeductions - paye,
        employer_contributions: 0,
        net,
      },
      lines,
      trace,
    };
  }

  private calculatePAYE(
    periodicTaxable: number,
    taxTables: TaxTableContext,
    periodsPerYear: number,
    trace: TraceEntry[],
  ): number {
    // Annualize
    const annualTaxable = periodicTaxable * periodsPerYear;

    trace.push({
      step: 'PAYE_ANNUALIZE',
      description: 'Annualize taxable income',
      formula: `${periodicTaxable} × ${periodsPerYear}`,
      output: annualTaxable,
    });

    // Apply brackets from database
    let annualTax = 0;
    let bracketUsed: typeof taxTables.brackets[0] | null = null;

    for (const bracket of taxTables.brackets) {
      if (annualTaxable > bracket.min) {
        bracketUsed = bracket;
        const max = bracket.max ?? Infinity;
        if (annualTaxable <= max) {
          annualTax = bracket.base_amount + (annualTaxable - bracket.min) * bracket.rate;
          break;
        }
      }
    }

    trace.push({
      step: 'PAYE_BRACKETS',
      description: 'Apply tax brackets from database',
      inputs: {
        annual_taxable: annualTaxable,
        bracket: bracketUsed,
      },
      formula: bracketUsed
        ? `${bracketUsed.base_amount} + (${annualTaxable} - ${bracketUsed.min}) × ${bracketUsed.rate}`
        : 'N/A',
      output: annualTax,
    });

    // Apply tax credit from database (meta.tax_credit or credits.tax_credit)
    const taxCredit = taxTables.meta?.tax_credit || 0;
    const taxAfterCredit = Math.max(0, annualTax - taxCredit);

    trace.push({
      step: 'PAYE_CREDIT',
      description: 'Apply annual tax credit from database',
      inputs: { annual_tax: annualTax, tax_credit: taxCredit },
      formula: `max(0, ${annualTax} - ${taxCredit})`,
      output: taxAfterCredit,
    });

    // De-annualize
    const periodicPaye = taxAfterCredit / periodsPerYear;

    trace.push({
      step: 'PAYE_PERIODIC',
      description: 'Convert to periodic PAYE',
      formula: `${taxAfterCredit} ÷ ${periodsPerYear}`,
      output: periodicPaye,
    });

    return this.round(periodicPaye, { mode: 'HALF_UP', decimals: 2 });
  }

  async post_process(
    ctx: PayrollComputeContext,
    result: ComputeResult,
  ): Promise<PostProcessResult> {
    let totalGross = 0;
    let totalPaye = 0;
    let totalNet = 0;

    for (const emp of result.employee_results) {
      totalGross += emp.totals.gross;
      totalPaye += emp.totals.paye;
      totalNet += emp.totals.net;
    }

    const statutoryPayloads = {
      LS: {
        PAYE_RETURN: {
          employer_tin: ctx.payrun.legal_entity_id,
          period_start: ctx.payrun.period.start,
          period_end: ctx.payrun.period.end,
          total_employees: result.employee_results.length,
          total_gross: totalGross,
          total_paye: totalPaye,
          employees: result.employee_results.map((emp) => ({
            employee_id: emp.employee_id,
            gross: emp.totals.gross,
            taxable: emp.totals.taxable_income,
            paye: emp.totals.paye,
          })),
        },
      },
    };

    return {
      statutory_payloads: statutoryPayloads,
      summary: {
        total_employees: result.employee_results.length,
        total_gross: totalGross,
        total_paye: totalPaye,
        total_statutory: 0,
        total_net: totalNet,
        total_employer_cost: totalGross,
      },
    };
  }

  private getPeriodsPerYear(periodType: string): number {
    switch (periodType) {
      case 'WEEKLY':
        return 52;
      case 'BI_WEEKLY':
        return 26;
      case 'SEMI_MONTHLY':
        return 24;
      case 'MONTHLY':
        return 12;
      default:
        return 12;
    }
  }

  private round(value: number, policy: { mode: string; decimals: number }): number {
    const factor = Math.pow(10, policy.decimals);
    switch (policy.mode) {
      case 'FLOOR':
        return Math.floor(value * factor) / factor;
      case 'CEILING':
        return Math.ceil(value * factor) / factor;
      case 'HALF_DOWN':
        return Math.round(value * factor - 0.0001) / factor;
      case 'HALF_UP':
      default:
        return Math.round(value * factor) / factor;
    }
  }
}
