import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Tax Table Validation Service
 *
 * Validates tax table data before activation:
 * - Gap/overlap checks between brackets
 * - Rate monotonicity (rates should increase with income)
 * - Bracket continuity (no missing ranges)
 * - Checksum calculation for reproducibility
 */

export interface TaxBracket {
  lower: number;
  upper: number | null; // null = infinity (top bracket)
  base_tax: number;
  rate: number;
  marginal_from: number;
}

export interface TaxTableData {
  country: 'LS' | 'ZA';
  tax_year: string; // e.g., "2025/2026"
  effective_from: string; // ISO date
  effective_to?: string; // ISO date, null = current
  brackets: TaxBracket[];
  rebates?: Record<string, number>;
  credits?: Record<string, number>;
  thresholds?: Record<string, number>;
  meta?: Record<string, any>;
  source_ref?: string; // e.g., "SARS Budget 2026 PDF"
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checksum: string;
}

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: Record<string, any>;
}

@Injectable()
export class TaxTableValidatorService {
  /**
   * Validate a tax table before activation
   */
  validate(table: TaxTableData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Basic structure validation
    this.validateStructure(table, errors);

    // 2. Bracket gap/overlap checks
    this.validateBracketContinuity(table.brackets, errors);

    // 3. Rate monotonicity check
    this.validateRateMonotonicity(table.brackets, errors, warnings);

    // 4. Base tax consistency check
    this.validateBaseTaxConsistency(table.brackets, errors);

    // 5. Effective date validation
    this.validateEffectiveDates(table, errors);

    // 6. Country-specific validations
    if (table.country === 'ZA') {
      this.validateZASpecific(table, errors, warnings);
    } else if (table.country === 'LS') {
      this.validateLSSpecific(table, errors, warnings);
    }

    // Calculate checksum for reproducibility
    const checksum = this.calculateChecksum(table);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checksum,
    };
  }

  private validateStructure(table: TaxTableData, errors: ValidationError[]) {
    if (!table.country) {
      errors.push({ code: 'MISSING_COUNTRY', message: 'Country code is required' });
    }

    if (!table.tax_year) {
      errors.push({ code: 'MISSING_TAX_YEAR', message: 'Tax year is required' });
    }

    if (!table.effective_from) {
      errors.push({ code: 'MISSING_EFFECTIVE_FROM', message: 'Effective from date is required' });
    }

    if (!table.brackets || table.brackets.length === 0) {
      errors.push({ code: 'MISSING_BRACKETS', message: 'At least one tax bracket is required' });
    }
  }

  private validateBracketContinuity(brackets: TaxBracket[], errors: ValidationError[]) {
    if (!brackets || brackets.length === 0) return;

    // Sort brackets by lower bound
    const sorted = [...brackets].sort((a, b) => a.lower - b.lower);

    // Check first bracket starts at 0
    if (sorted[0].lower !== 0) {
      errors.push({
        code: 'GAP_AT_START',
        message: 'First bracket must start at 0',
        details: { first_lower: sorted[0].lower },
      });
    }

    // Check for gaps and overlaps between consecutive brackets
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (current.upper === null) {
        errors.push({
          code: 'INFINITE_BRACKET_NOT_LAST',
          message: 'Only the last bracket can have unlimited upper bound',
          details: { bracket_index: i },
        });
        continue;
      }

      // Check for gap: current.upper + 1 should equal next.lower
      if (current.upper + 1 !== next.lower) {
        if (current.upper + 1 < next.lower) {
          errors.push({
            code: 'GAP_BETWEEN_BRACKETS',
            message: `Gap found between brackets: ${current.upper} to ${next.lower}`,
            details: {
              bracket_index: i,
              gap_start: current.upper + 1,
              gap_end: next.lower - 1,
            },
          });
        } else {
          errors.push({
            code: 'OVERLAP_BETWEEN_BRACKETS',
            message: `Overlap found between brackets at ${next.lower}`,
            details: {
              bracket_index: i,
              overlap_amount: current.upper - next.lower + 1,
            },
          });
        }
      }
    }

    // Check last bracket has unlimited upper bound
    const lastBracket = sorted[sorted.length - 1];
    if (lastBracket.upper !== null) {
      errors.push({
        code: 'LAST_BRACKET_BOUNDED',
        message: 'Last bracket must have unlimited upper bound (null)',
        details: { last_upper: lastBracket.upper },
      });
    }
  }

  private validateRateMonotonicity(
    brackets: TaxBracket[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    if (!brackets || brackets.length < 2) return;

    const sorted = [...brackets].sort((a, b) => a.lower - b.lower);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Rates should increase or stay the same (progressive tax)
      if (next.rate < current.rate) {
        errors.push({
          code: 'NON_PROGRESSIVE_RATES',
          message: `Rate decreases from ${current.rate * 100}% to ${next.rate * 100}%`,
          details: {
            bracket_index: i,
            current_rate: current.rate,
            next_rate: next.rate,
          },
        });
      }

      // Warn if rates are equal (unusual but not invalid)
      if (next.rate === current.rate) {
        warnings.push({
          code: 'EQUAL_CONSECUTIVE_RATES',
          message: `Consecutive brackets have same rate: ${current.rate * 100}%`,
          details: { bracket_index: i },
        });
      }
    }

    // Check rate bounds (0% to 100%)
    for (let i = 0; i < sorted.length; i++) {
      const bracket = sorted[i];
      if (bracket.rate < 0 || bracket.rate > 1) {
        errors.push({
          code: 'INVALID_RATE',
          message: `Rate must be between 0 and 1, got ${bracket.rate}`,
          details: { bracket_index: i },
        });
      }
    }
  }

  private validateBaseTaxConsistency(brackets: TaxBracket[], errors: ValidationError[]) {
    if (!brackets || brackets.length < 2) return;

    const sorted = [...brackets].sort((a, b) => a.lower - b.lower);

    // First bracket should have base_tax = 0
    if (sorted[0].base_tax !== 0) {
      errors.push({
        code: 'FIRST_BRACKET_BASE_TAX',
        message: 'First bracket must have base_tax = 0',
        details: { base_tax: sorted[0].base_tax },
      });
    }

    // Each bracket's base_tax should equal previous cumulative tax
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.upper === null) continue;

      // Expected base_tax = prev.base_tax + (prev.upper - prev.marginal_from) * prev.rate
      const expectedBaseTax = prev.base_tax + (prev.upper - prev.marginal_from) * prev.rate;
      const tolerance = 1; // Allow R1 tolerance for rounding

      if (Math.abs(curr.base_tax - expectedBaseTax) > tolerance) {
        errors.push({
          code: 'BASE_TAX_INCONSISTENCY',
          message: `Bracket ${i} base_tax (${curr.base_tax}) doesn't match expected (${expectedBaseTax.toFixed(0)})`,
          details: {
            bracket_index: i,
            expected: Math.round(expectedBaseTax),
            actual: curr.base_tax,
          },
        });
      }
    }
  }

  private validateEffectiveDates(table: TaxTableData, errors: ValidationError[]) {
    const effectiveFrom = new Date(table.effective_from);

    if (isNaN(effectiveFrom.getTime())) {
      errors.push({
        code: 'INVALID_EFFECTIVE_FROM',
        message: 'Invalid effective_from date format',
      });
    }

    if (table.effective_to) {
      const effectiveTo = new Date(table.effective_to);

      if (isNaN(effectiveTo.getTime())) {
        errors.push({
          code: 'INVALID_EFFECTIVE_TO',
          message: 'Invalid effective_to date format',
        });
      } else if (effectiveTo <= effectiveFrom) {
        errors.push({
          code: 'EFFECTIVE_DATE_ORDER',
          message: 'effective_to must be after effective_from',
        });
      }
    }
  }

  private validateZASpecific(
    table: TaxTableData,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    // ZA requires rebates
    if (!table.rebates) {
      warnings.push({
        code: 'MISSING_ZA_REBATES',
        message: 'South Africa tax tables should include rebates',
      });
    } else {
      if (!table.rebates.primary) {
        warnings.push({
          code: 'MISSING_PRIMARY_REBATE',
          message: 'Primary rebate not specified',
        });
      }
      if (!table.rebates.secondary) {
        warnings.push({
          code: 'MISSING_SECONDARY_REBATE',
          message: 'Secondary rebate (65+) not specified',
        });
      }
      if (!table.rebates.tertiary) {
        warnings.push({
          code: 'MISSING_TERTIARY_REBATE',
          message: 'Tertiary rebate (75+) not specified',
        });
      }
    }

    // ZA typically has 7 brackets
    if (table.brackets.length !== 7) {
      warnings.push({
        code: 'UNUSUAL_BRACKET_COUNT',
        message: `ZA typically has 7 tax brackets, found ${table.brackets.length}`,
      });
    }
  }

  private validateLSSpecific(
    table: TaxTableData,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    // LS uses tax credits, not rebates
    if (!table.credits) {
      warnings.push({
        code: 'MISSING_LS_CREDITS',
        message: 'Lesotho tax tables should include tax credits',
      });
    } else {
      if (!table.credits.tax_credit) {
        warnings.push({
          code: 'MISSING_TAX_CREDIT',
          message: 'Annual tax credit not specified',
        });
      }
    }

    // LS typically has 4 brackets
    if (table.brackets.length !== 4) {
      warnings.push({
        code: 'UNUSUAL_BRACKET_COUNT',
        message: `LS typically has 4 tax brackets, found ${table.brackets.length}`,
      });
    }
  }

  /**
   * Calculate deterministic checksum for the tax table
   * Used for reproducibility verification
   */
  calculateChecksum(table: TaxTableData): string {
    // Create deterministic JSON representation
    const canonical = {
      country: table.country,
      tax_year: table.tax_year,
      effective_from: table.effective_from,
      brackets: table.brackets.map((b) => ({
        lower: b.lower,
        upper: b.upper,
        base_tax: b.base_tax,
        rate: b.rate,
        marginal_from: b.marginal_from,
      })),
      rebates: table.rebates || null,
      credits: table.credits || null,
      thresholds: table.thresholds || null,
    };

    const json = JSON.stringify(canonical, Object.keys(canonical).sort());
    return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /**
   * Compare two tax tables for equality
   */
  tablesEqual(table1: TaxTableData, table2: TaxTableData): boolean {
    return this.calculateChecksum(table1) === this.calculateChecksum(table2);
  }
}
