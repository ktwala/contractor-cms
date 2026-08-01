import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PayItemType, Country } from '../../common/dto/enums.dto';

/**
 * Context available for formula evaluation
 */
export interface FormulaContext {
  /** Employee's base salary */
  BASIC: number;
  /** Running gross pay total */
  GROSS?: number;
  /** Taxable income (after pre-tax deductions) */
  TAXABLE?: number;
  /** All evaluated pay items by code */
  [key: string]: number | undefined;
}

/**
 * A pay item with potential formula
 */
export interface FormulaPayItem {
  id: string;
  code: string;
  name: string;
  type: PayItemType;
  taxable: boolean;
  formula: string | null;
  formulaDeps: string[];
  glAccount: string | null;
  countryAttributes: any;
  sortOrder: number;
}

/**
 * Result of formula evaluation
 */
export interface EvaluatedPayItem {
  code: string;
  name: string;
  type: PayItemType;
  amount: number;
  is_taxable: boolean;
  classification: string;
  source: 'formula' | 'input' | 'system';
  formula_trace?: string;
}

/**
 * FormulaEvaluationService
 *
 * Evaluates pay item formulas with dependency resolution.
 * Supports formulas like:
 *   - "BASIC * 0.01" (UIF = 1% of basic)
 *   - "GROSS * 0.075" (Pension = 7.5% of gross)
 *   - "MIN(BASIC * 0.01, 177.12)" (UIF with cap)
 *
 * Built-in functions:
 *   - MIN(a, b) - Returns minimum value
 *   - MAX(a, b) - Returns maximum value
 *   - ROUND(a, decimals) - Rounds to decimal places
 *   - ANNUAL(a) - Converts monthly to annual (a * 12)
 *   - MONTHLY(a) - Converts annual to monthly (a / 12)
 */
@Injectable()
export class FormulaEvaluationService {
  private readonly logger = new Logger(FormulaEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load all active pay items with formulas for a country
   */
  async loadFormulaPayItems(
    country: Country,
    payGroupId?: string,
  ): Promise<FormulaPayItem[]> {
    const items = await this.prisma.payItem.findMany({
      where: {
        isActive: true,
        formula: { not: null },
        OR: payGroupId
          ? [{ payGroupId }, { payGroupId: null }]
          : [{ payGroupId: null }],
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    // Filter by country if country attributes exist
    return items.filter((item) => {
      const attrs = item.countryAttributes as any;
      if (!attrs) return true;
      return attrs[country] !== undefined || Object.keys(attrs).length === 0;
    }) as FormulaPayItem[];
  }

  /**
   * Evaluate all formula-based pay items given a context
   */
  evaluateFormulas(
    payItems: FormulaPayItem[],
    baseContext: FormulaContext,
    country: Country,
  ): EvaluatedPayItem[] {
    const results: EvaluatedPayItem[] = [];
    const context = { ...baseContext };

    // Build dependency graph and sort topologically
    let sorted: FormulaPayItem[];
    try {
      sorted = this.topologicalSort(payItems);
    } catch (error) {
      this.logger.error(`Failed to sort formulas topologically: ${error.message}`);
      throw new Error(`Formula dependency resolution failed: ${error.message}`);
    }

    const evaluationErrors: Array<{ code: string; error: string }> = [];

    for (const item of sorted) {
      if (!item.formula) continue;

      try {
        const amount = this.evaluateFormula(item.formula, context);

        if (!isFinite(amount) || isNaN(amount)) {
          throw new Error(`Formula resulted in invalid number: ${amount}`);
        }

        // Apply country-specific caps or limits
        const finalAmount = this.applyCountryLimits(item, amount, context, country);

        if (!isFinite(finalAmount) || isNaN(finalAmount)) {
          throw new Error(`Country limits resulted in invalid number: ${finalAmount}`);
        }

        // Add to context for dependent formulas
        context[item.code] = finalAmount;

        results.push({
          code: item.code,
          name: item.name,
          type: item.type,
          amount: finalAmount,
          is_taxable: this.getTaxableForCountry(item, country),
          classification: this.getClassification(item.code, item.type),
          source: 'formula',
          formula_trace: `${item.formula} => ${finalAmount}`,
        });
      } catch (error) {
        const errorMsg = `Failed to evaluate formula for ${item.code} (${item.formula}): ${error.message}`;
        this.logger.error(errorMsg);
        evaluationErrors.push({
          code: item.code,
          error: errorMsg,
        });
      }
    }

    if (evaluationErrors.length > 0) {
      throw new Error(
        `Failed to evaluate ${evaluationErrors.length} formulas: ${evaluationErrors
          .map((e) => e.code)
          .join(', ')}`,
      );
    }

    return results;
  }

  /**
   * Evaluate a single formula expression
   */
  evaluateFormula(formula: string, context: FormulaContext): number {
    if (!formula || formula.trim() === '') {
      throw new Error('Formula is empty or undefined');
    }

    let expression = formula.trim();

    // Replace built-in functions
    try {
      expression = this.replaceFunctions(expression, context);
    } catch (error) {
      throw new Error(`Function replacement failed: ${error.message}`);
    }

    // Replace variable names with values
    const missingVars: string[] = [];
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        if (regex.test(expression)) {
          expression = expression.replace(regex, value.toString());
        }
      }
    }

    // Check for unresolved variables
    const variablePattern = /\b[A-Z_][A-Z0-9_]*\b/g;
    const unresolvedVars = expression.match(variablePattern);
    if (unresolvedVars && unresolvedVars.length > 0) {
      missingVars.push(...unresolvedVars);
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Formula contains unresolved variables: ${missingVars.join(', ')}. Formula: ${formula}`,
      );
    }

    // Validate expression (only allow safe characters)
    if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
      throw new Error(
        `Formula contains invalid characters after variable substitution. Original: ${formula}, Processed: ${expression}`,
      );
    }

    // Check for division by zero
    if (/\/\s*0(?:\D|$)/.test(expression)) {
      throw new Error(`Formula contains division by zero: ${formula}`);
    }

    try {
      // Safe evaluation using Function constructor
      const result = Function(`"use strict"; return (${expression})`)();

      if (typeof result !== 'number') {
        throw new Error(`Formula did not return a number. Result type: ${typeof result}`);
      }

      if (!isFinite(result)) {
        throw new Error(`Formula resulted in Infinity or -Infinity`);
      }

      if (isNaN(result)) {
        throw new Error(`Formula resulted in NaN`);
      }

      // Round to 2 decimal places
      return Math.round(result * 100) / 100;
    } catch (error) {
      throw new Error(
        `Formula evaluation error for "${formula}". Expression: "${expression}". Error: ${error.message}`,
      );
    }
  }

  /**
   * Replace built-in functions in expression
   */
  private replaceFunctions(expression: string, context: FormulaContext): string {
    let result = expression;

    // MIN(a, b) function
    result = result.replace(
      /MIN\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (match, a, b) => {
        try {
          const valA = this.resolveValue(a, context);
          const valB = this.resolveValue(b, context);
          if (!isFinite(valA) || !isFinite(valB)) {
            throw new Error(`MIN function received non-finite values: ${valA}, ${valB}`);
          }
          return Math.min(valA, valB).toString();
        } catch (error) {
          throw new Error(`MIN function error in "${match}": ${error.message}`);
        }
      },
    );

    // MAX(a, b) function
    result = result.replace(
      /MAX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (match, a, b) => {
        try {
          const valA = this.resolveValue(a, context);
          const valB = this.resolveValue(b, context);
          if (!isFinite(valA) || !isFinite(valB)) {
            throw new Error(`MAX function received non-finite values: ${valA}, ${valB}`);
          }
          return Math.max(valA, valB).toString();
        } catch (error) {
          throw new Error(`MAX function error in "${match}": ${error.message}`);
        }
      },
    );

    // ROUND(a, decimals) function
    result = result.replace(
      /ROUND\s*\(\s*([^,]+)\s*,\s*(\d+)\s*\)/gi,
      (match, a, decimals) => {
        try {
          const val = this.resolveValue(a, context);
          const d = parseInt(decimals, 10);
          if (d < 0 || d > 10) {
            throw new Error(`ROUND decimals must be between 0 and 10, got ${d}`);
          }
          if (!isFinite(val)) {
            throw new Error(`ROUND function received non-finite value: ${val}`);
          }
          const factor = Math.pow(10, d);
          return (Math.round(val * factor) / factor).toString();
        } catch (error) {
          throw new Error(`ROUND function error in "${match}": ${error.message}`);
        }
      },
    );

    // ANNUAL(a) function - monthly to annual
    result = result.replace(/ANNUAL\s*\(\s*([^)]+)\s*\)/gi, (match, a) => {
      try {
        const val = this.resolveValue(a, context);
        if (!isFinite(val)) {
          throw new Error(`ANNUAL function received non-finite value: ${val}`);
        }
        return (val * 12).toString();
      } catch (error) {
        throw new Error(`ANNUAL function error in "${match}": ${error.message}`);
      }
    });

    // MONTHLY(a) function - annual to monthly
    result = result.replace(/MONTHLY\s*\(\s*([^)]+)\s*\)/gi, (match, a) => {
      try {
        const val = this.resolveValue(a, context);
        if (!isFinite(val)) {
          throw new Error(`MONTHLY function received non-finite value: ${val}`);
        }
        return (val / 12).toString();
      } catch (error) {
        throw new Error(`MONTHLY function error in "${match}": ${error.message}`);
      }
    });

    return result;
  }

  /**
   * Resolve a value from expression or context
   */
  private resolveValue(expr: string, context: FormulaContext): number {
    const trimmed = expr.trim();

    if (!trimmed) {
      throw new Error('Empty expression provided to resolveValue');
    }

    // Check if it's a context variable
    if (context[trimmed] !== undefined) {
      const value = context[trimmed]!;
      if (!isFinite(value)) {
        throw new Error(`Context variable ${trimmed} has non-finite value: ${value}`);
      }
      return value;
    }

    // Check if it's a direct number
    const directNumber = parseFloat(trimmed);
    if (!isNaN(directNumber)) {
      if (!isFinite(directNumber)) {
        throw new Error(`Direct number is not finite: ${trimmed}`);
      }
      return directNumber;
    }

    // Try to evaluate as expression
    let resolved = trimmed;
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        resolved = resolved.replace(
          new RegExp(`\\b${key}\\b`, 'g'),
          value.toString(),
        );
      }
    }

    try {
      const result = Function(`"use strict"; return (${resolved})`)();
      if (typeof result !== 'number') {
        throw new Error(`Expression did not evaluate to a number: ${trimmed}`);
      }
      if (!isFinite(result)) {
        throw new Error(`Expression evaluated to non-finite number: ${trimmed}`);
      }
      return result;
    } catch (error) {
      throw new Error(`Failed to resolve value for "${trimmed}": ${error.message}`);
    }
  }

  /**
   * Topologically sort pay items by dependencies
   */
  private topologicalSort(payItems: FormulaPayItem[]): FormulaPayItem[] {
    const itemMap = new Map(payItems.map((item) => [item.code, item]));
    const visited = new Set<string>();
    const result: FormulaPayItem[] = [];

    const visit = (code: string) => {
      if (visited.has(code)) return;
      visited.add(code);

      const item = itemMap.get(code);
      if (!item) return;

      // Visit dependencies first
      for (const dep of item.formulaDeps || []) {
        if (itemMap.has(dep)) {
          visit(dep);
        }
      }

      result.push(item);
    };

    // Visit all items
    for (const item of payItems) {
      visit(item.code);
    }

    return result;
  }

  /**
   * Apply country-specific limits/caps to calculated amount
   */
  private applyCountryLimits(
    item: FormulaPayItem,
    amount: number,
    context: FormulaContext,
    country: Country,
  ): number {
    const attrs = item.countryAttributes as any;
    const countryAttrs = attrs?.[country];

    if (!countryAttrs) return amount;

    try {
      // Apply ceiling if defined (e.g., UIF ceiling)
      if (countryAttrs.ceiling !== undefined) {
        const ceiling = parseFloat(countryAttrs.ceiling);
        if (isNaN(ceiling) || !isFinite(ceiling)) {
          throw new Error(`Invalid ceiling value: ${countryAttrs.ceiling}`);
        }
        // Ceiling is typically on the base, not the result
        const cappedBase = Math.min(context.BASIC || 0, ceiling);
        // Recalculate with capped base
        if (item.formula && context.BASIC && context.BASIC > ceiling) {
          const cappedContext = { ...context, BASIC: cappedBase };
          return this.evaluateFormula(item.formula, cappedContext);
        }
      }

      // Apply max amount if defined
      if (countryAttrs.max_amount !== undefined) {
        const maxAmount = parseFloat(countryAttrs.max_amount);
        if (isNaN(maxAmount) || !isFinite(maxAmount)) {
          throw new Error(`Invalid max_amount value: ${countryAttrs.max_amount}`);
        }
        return Math.min(amount, maxAmount);
      }

      return amount;
    } catch (error) {
      throw new Error(
        `Failed to apply country limits for ${item.code} in ${country}: ${error.message}`,
      );
    }
  }

  /**
   * Get taxable status for a country
   */
  private getTaxableForCountry(item: FormulaPayItem, country: Country): boolean {
    const attrs = item.countryAttributes as any;
    const countryAttrs = attrs?.[country];

    if (countryAttrs?.taxable !== undefined) {
      return countryAttrs.taxable;
    }

    return item.taxable;
  }

  /**
   * Map pay item code to classification
   */
  private getClassification(code: string, type: PayItemType): string {
    const mapping: Record<string, string> = {
      // Earnings
      BASIC: 'BASIC_SALARY',
      OVERTIME: 'OVERTIME',
      COMMISSION: 'COMMISSION',
      BONUS: 'BONUS',
      ALLOWANCE: 'ALLOWANCE_TAXABLE',

      // Statutory deductions
      UIF: 'STATUTORY_UIF',
      UIF_EE: 'STATUTORY_UIF',
      PAYE: 'STATUTORY_PAYE',
      SDL: 'STATUTORY_SDL',

      // Retirement
      PENSION_EE: 'RETIREMENT_CONTRIBUTION',
      PROVIDENT_EE: 'RETIREMENT_CONTRIBUTION',
      RA_EE: 'RETIREMENT_CONTRIBUTION',

      // Medical
      MEDICAL_AID_EE: 'MEDICAL_AID_CONTRIBUTION',

      // Other
      LOAN_REPAYMENT: 'OTHER',
    };

    return mapping[code] || (type === PayItemType.EARNING ? 'OTHER_EARNING' : 'OTHER');
  }
}
