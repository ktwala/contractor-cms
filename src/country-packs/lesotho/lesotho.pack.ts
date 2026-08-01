import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  ICountryPack,
  CountryPackMetadata,
  TaxCalculationInput,
  TaxCalculationResult,
  DeductionCalculationInput,
  DeductionResult,
  StatutoryExportFormat,
  ExportGenerationInput,
  TaxTraceEntry,
} from '../interfaces/country-pack.interface';

/**
 * Lesotho Country Pack
 *
 * Tax Year: April 1 - March 31
 * Currency: Lesotho Loti (LSL), pegged 1:1 with ZAR
 *
 * Key features:
 * - Progressive PAYE tax brackets (from database)
 * - Tax credits system (from database)
 * - No UIF or SDL (South African specific)
 * 
 * IMPORTANT: Tax brackets and credits are loaded from the database.
 * This pack contains only the calculation logic, not the rates.
 */
@Injectable()
export class LesothoCountryPack implements ICountryPack {
  readonly metadata: CountryPackMetadata = {
    countryCode: 'LS',
    countryName: 'Lesotho',
    defaultCurrency: 'LSL',
    supportedCurrencies: ['LSL'],
    taxYearStart: { month: 4, day: 1 }, // April 1
    taxYearEnd: { month: 3, day: 31 }, // March 31
    version: '2025.1',
  };

  /**
   * Calculate PAYE tax using brackets from database
   * 
   * @param input - Must include taxTableData with brackets and credits
   */
  async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const trace: TaxTraceEntry[] = [];

    // Validate tax table data is provided
    if (!input.taxTableData) {
      throw new Error('Tax table data is required. Ensure database is seeded with tax tables.');
    }

    const { brackets, credits, periods_per_year } = input.taxTableData;

    if (!brackets || brackets.length === 0) {
      throw new Error('Tax brackets are required in taxTableData');
    }

    const periodsPerYear = periods_per_year?.[input.payPeriodType] || this.getPeriodsPerYear(input.payPeriodType);
    const taxCredit = credits?.tax_credit || 0;

    trace.push({
      step: 'START',
      description: 'Beginning Lesotho PAYE calculation (database-driven)',
      input: {
        taxableIncome: input.taxableIncome.toString(),
        payPeriodType: input.payPeriodType,
        periodsPerYear,
        taxCredit,
        bracketCount: brackets.length,
      },
    });

    // Step 1: Annualize the taxable income
    const annualTaxableIncome = input.taxableIncome.mul(periodsPerYear);
    trace.push({
      step: 'ANNUALIZE',
      description: 'Convert periodic income to annual equivalent',
      formula: `${input.taxableIncome} × ${periodsPerYear}`,
      output: annualTaxableIncome.toString(),
    });

    // Step 2: Calculate annual tax using brackets from database
    let annualTax = new Decimal(0);
    const annualAmount = annualTaxableIncome.toNumber();
    let bracketUsed: typeof brackets[0] | null = null;

    for (const bracket of brackets) {
      if (annualAmount > bracket.min) {
        bracketUsed = bracket;
        const max = bracket.max ?? Infinity;
        if (annualAmount <= max) {
          // Income falls within this bracket
          annualTax = new Decimal(bracket.base_amount).add(
            new Decimal(annualAmount - bracket.min).mul(bracket.rate)
          );
          break;
        }
      }
    }

    trace.push({
      step: 'BRACKET_CALC',
      description: 'Apply progressive tax brackets',
      input: {
        annualTaxableIncome: annualTaxableIncome.toString(),
        bracket: bracketUsed,
      },
      formula: bracketUsed
        ? `${bracketUsed.base_amount} + (${annualAmount} - ${bracketUsed.min}) × ${bracketUsed.rate * 100}%`
        : 'N/A',
      output: annualTax.toString(),
    });

    // Step 3: Apply tax credit from database
    const taxCreditDecimal = new Decimal(taxCredit);
    const taxAfterCredit = Decimal.max(annualTax.sub(taxCreditDecimal), new Decimal(0));

    trace.push({
      step: 'TAX_CREDIT',
      description: 'Apply annual tax credit',
      formula: `max(${annualTax} - ${taxCredit}, 0)`,
      output: taxAfterCredit.toString(),
    });

    // Step 4: De-annualize to get periodic PAYE
    const periodicPaye = taxAfterCredit.div(periodsPerYear).toDecimalPlaces(2);

    trace.push({
      step: 'DE_ANNUALIZE',
      description: 'Convert annual tax to periodic amount',
      formula: `${taxAfterCredit} ÷ ${periodsPerYear}`,
      output: periodicPaye.toString(),
    });

    trace.push({
      step: 'COMPLETE',
      description: 'PAYE calculation complete',
      output: {
        periodicPaye: periodicPaye.toString(),
        annualTax: taxAfterCredit.toString(),
      },
    });

    return {
      paye: periodicPaye,
      additionalTaxes: [], // Lesotho doesn't have UIF/SDL
      trace,
    };
  }

  async calculateStatutoryDeductions(input: DeductionCalculationInput): Promise<DeductionResult[]> {
    // Lesotho doesn't have mandatory statutory deductions like UIF/SDL
    // Pension contributions are typically voluntary/employer-specific
    return [];
  }

  getStatutoryExportFormats(): StatutoryExportFormat[] {
    return [
      {
        formatId: 'LS_PAYE_RETURN',
        name: 'PAYE Monthly Return',
        description: 'Monthly PAYE return for Lesotho Revenue Authority',
        fileExtension: 'csv',
      },
      {
        formatId: 'LS_ANNUAL_RECONCILIATION',
        name: 'Annual Tax Reconciliation',
        description: 'Year-end employee tax reconciliation',
        fileExtension: 'csv',
      },
    ];
  }

  async generateStatutoryExport(input: ExportGenerationInput): Promise<Buffer | string> {
    switch (input.formatId) {
      case 'LS_PAYE_RETURN':
        return this.generatePayeReturn(input);
      case 'LS_ANNUAL_RECONCILIATION':
        return this.generateAnnualReconciliation(input);
      default:
        throw new Error(`Unknown export format: ${input.formatId}`);
    }
  }

  private generatePayeReturn(input: ExportGenerationInput): string {
    const lines: string[] = [];

    // Header
    lines.push([
      'Employer_TIN',
      'Employee_TIN',
      'Employee_Name',
      'Gross_Income',
      'Taxable_Income',
      'PAYE',
      'Period_Start',
      'Period_End',
    ].join(','));

    // Data rows
    for (const result of input.employeeResults) {
      lines.push([
        input.legalEntity.tax_id || '',
        result.taxNumber || '',
        `"${result.employeeName || ''}"`,
        result.grossPay || '0',
        result.taxableIncome || '0',
        result.paye || '0',
        input.payPeriod.period_start,
        input.payPeriod.period_end,
      ].join(','));
    }

    return lines.join('\n');
  }

  private generateAnnualReconciliation(input: ExportGenerationInput): string {
    const lines: string[] = [];

    lines.push([
      'Tax_Year',
      'Employee_TIN',
      'Employee_Name',
      'Annual_Gross',
      'Annual_Taxable',
      'Annual_PAYE',
    ].join(','));

    for (const result of input.employeeResults) {
      lines.push([
        input.payPeriod.tax_year || '',
        result.taxNumber || '',
        `"${result.employeeName || ''}"`,
        result.annualGross || '0',
        result.annualTaxable || '0',
        result.annualPaye || '0',
      ].join(','));
    }

    return lines.join('\n');
  }

  validateTaxNumber(taxNumber: string): { valid: boolean; message?: string } {
    // Lesotho TIN format: typically 9 digits
    const cleaned = taxNumber.replace(/[\s-]/g, '');

    if (!/^\d{9}$/.test(cleaned)) {
      return {
        valid: false,
        message: 'Lesotho TIN must be exactly 9 digits',
      };
    }

    return { valid: true };
  }

  getPeriodsPerYear(periodType: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY'): number {
    switch (periodType) {
      case 'WEEKLY':
        return 52;
      case 'BI_WEEKLY':
        return 26;
      case 'SEMI_MONTHLY':
        return 24;
      case 'MONTHLY':
        return 12;
    }
  }
}
