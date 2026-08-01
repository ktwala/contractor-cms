import { Injectable, Logger } from '@nestjs/common';
import {
  PayrollResultLine,
  PayrollEmployeeResult,
  StatutoryLineSummary,
} from './payroll-result.types';
import {
  LINE_CODES,
  RAW_CODE_MAP,
  LineCodeDefinition,
} from './payroll-result.constants';

interface RawEmployeeResult {
  employee_id: string;
  employee_code?: string;
  employee_number?: string;
  employee_name?: string;
  gross: number;
  taxable_income: number;
  paye: number;
  net: number;
  lines: Array<{
    code: string;
    name?: string;
    type: string;
    amount: number;
    is_taxable?: boolean;
    trace?: Record<string, any>;
  }>;
}

export interface NormalizationContext {
  country_code: string;
  currency: string;
  source_pack?: string;
}

@Injectable()
export class PayrollResultNormalizerService {
  private readonly logger = new Logger(PayrollResultNormalizerService.name);

  normalize(
    ctx: NormalizationContext,
    rawResults: RawEmployeeResult[],
  ): PayrollEmployeeResult[] {
    return rawResults.map((raw) => this.normalizeEmployee(ctx, raw));
  }

  buildStatutoryTotals(results: PayrollEmployeeResult[]): StatutoryLineSummary[] {
    const statutoryMap = new Map<string, StatutoryLineSummary>();

    for (const r of results) {
      for (const line of r.lines) {
        if (!line.is_statutory) continue;

        const existing = statutoryMap.get(line.code);
        if (existing) {
          existing.total += line.amount;
        } else {
          statutoryMap.set(line.code, {
            code: line.code,
            label: line.label,
            total: line.amount,
            statutory_group: line.statutory_group,
            side: line.bucket === 'employee_deduction' ? 'employee' : 'employer',
          });
        }
      }
    }

    return Array.from(statutoryMap.values());
  }

  /**
   * Validates that no statutory line has been set to hidden visibility.
   * Throws if a statutory line is concealed.
   */
  validateStatutoryVisibility(lines: PayrollResultLine[]): void {
    for (const line of lines) {
      if (line.is_statutory && line.visibility === 'hidden') {
        throw new Error(
          `Statutory line ${line.code} (${line.label}) must not be hidden. ` +
          `Statutory items must always be visible in summary or detail.`,
        );
      }
    }
  }

  /**
   * Validates that every raw engine line maps to a known stable code.
   * Logs warnings for unmapped codes so they can be added to the registry.
   */
  validateEngineCoverage(rawCodes: string[]): string[] {
    const unmapped: string[] = [];
    for (const code of rawCodes) {
      const stableCode = RAW_CODE_MAP[code] ?? code;
      if (!LINE_CODES[stableCode]) {
        unmapped.push(code);
      }
    }
    if (unmapped.length > 0) {
      this.logger.warn(
        `Unmapped engine line codes detected: ${unmapped.join(', ')}. ` +
        `Add these to RAW_CODE_MAP and LINE_CODES to ensure proper normalization.`,
      );
    }
    return unmapped;
  }

  private normalizeEmployee(
    ctx: NormalizationContext,
    raw: RawEmployeeResult,
  ): PayrollEmployeeResult {
    this.validateEngineCoverage(raw.lines.map((l) => l.code));

    const lines = this.normalizeLines(ctx, raw.lines);
    this.validateStatutoryVisibility(lines);

    const earningsTotal = this.sumBucket(lines, 'earning');
    const employeeDeductionsTotal = this.sumBucket(lines, 'employee_deduction');
    const employerContributionsTotal = this.sumBucket(lines, 'employer_contribution');
    const employerLeviesTotal = this.sumBucket(lines, 'employer_levy');

    const gross = earningsTotal || raw.gross;
    const netPay = gross - employeeDeductionsTotal;
    const employerCost = gross + employerContributionsTotal + employerLeviesTotal;

    return {
      employee_id: raw.employee_id,
      employee_code: raw.employee_code,
      employee_number: raw.employee_number,
      employee_name: raw.employee_name,
      country_code: ctx.country_code,
      currency: ctx.currency,
      gross,
      taxable_income: raw.taxable_income,
      earnings_total: earningsTotal || raw.gross,
      employee_deductions_total: employeeDeductionsTotal,
      employer_contributions_total: employerContributionsTotal,
      employer_levies_total: employerLeviesTotal,
      net_pay: netPay,
      employer_cost: employerCost,
      lines,
      summary_line_amounts: this.buildSummaryLineAmounts(lines),
      display_schema_key: `${ctx.country_code}.v1`,
    };
  }

  private normalizeLines(
    ctx: NormalizationContext,
    rawLines: RawEmployeeResult['lines'],
  ): PayrollResultLine[] {
    const normalized: PayrollResultLine[] = [];

    for (const raw of rawLines) {
      const stableCode = RAW_CODE_MAP[raw.code] ?? raw.code;
      const definition = LINE_CODES[stableCode];

      if (definition) {
        normalized.push(this.fromDefinition(definition, raw.amount, ctx, raw.trace));
      } else {
        normalized.push(this.inferLine(stableCode, raw, ctx));
      }
    }

    return normalized.sort((a, b) => a.sort_order - b.sort_order);
  }

  private fromDefinition(
    def: LineCodeDefinition,
    amount: number,
    ctx: NormalizationContext,
    rawMetadata?: Record<string, unknown>,
  ): PayrollResultLine {
    const metadata: Record<string, unknown> = { ...rawMetadata };
    if (ctx.source_pack) metadata.source_pack = ctx.source_pack;

    return {
      code: def.code,
      label: def.label,
      amount,
      currency: ctx.currency,
      bucket: def.bucket,
      category: def.category,
      is_statutory: def.is_statutory,
      statutory_group: def.statutory_group,
      affects_net_pay: def.affects_net_pay,
      affects_employer_cost: def.affects_employer_cost,
      visibility: def.visibility,
      sort_order: def.sort_order,
      period_amount: amount,
      ytd_amount: undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private inferLine(
    code: string,
    raw: { name?: string; type: string; amount: number; trace?: Record<string, any> },
    ctx: NormalizationContext,
  ): PayrollResultLine {
    const typeMap: Record<string, { bucket: PayrollResultLine['bucket']; category: PayrollResultLine['category']; is_statutory: boolean }> = {
      EARNING:               { bucket: 'earning',               category: 'other',           is_statutory: false },
      DEDUCTION:             { bucket: 'employee_deduction',    category: 'other',           is_statutory: false },
      TAX:                   { bucket: 'employee_deduction',    category: 'tax',             is_statutory: true },
      STATUTORY:             { bucket: 'employee_deduction',    category: 'social_security', is_statutory: true },
      EMPLOYER_CONTRIBUTION: { bucket: 'employer_contribution', category: 'other',           is_statutory: false },
      EMPLOYER_CONTRIB:      { bucket: 'employer_contribution', category: 'other',           is_statutory: false },
    };

    const mapped = typeMap[raw.type] ?? { bucket: 'earning' as const, category: 'other' as const, is_statutory: false };

    const metadata: Record<string, unknown> = { ...raw.trace };
    if (ctx.source_pack) metadata.source_pack = ctx.source_pack;

    return {
      code,
      label: raw.name || code,
      amount: raw.amount,
      currency: ctx.currency,
      bucket: mapped.bucket,
      category: mapped.category,
      is_statutory: mapped.is_statutory,
      affects_net_pay: mapped.bucket === 'employee_deduction',
      affects_employer_cost: mapped.bucket === 'employer_contribution' || mapped.bucket === 'employer_levy',
      visibility: 'detail',
      sort_order: 900,
      period_amount: raw.amount,
      ytd_amount: undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private buildSummaryLineAmounts(lines: PayrollResultLine[]): Record<string, number> {
    const result: Record<string, number> = {};

    for (const line of lines) {
      result[line.code] = (result[line.code] ?? 0) + line.amount;
    }

    result['OTHER_DEDUCTIONS_TOTAL'] = lines
      .filter((l) => l.bucket === 'employee_deduction' && !l.is_statutory)
      .reduce((sum, l) => sum + l.amount, 0);

    result['STATUTORY_DEDUCTIONS_TOTAL'] = lines
      .filter((l) => l.is_statutory)
      .reduce((sum, l) => sum + l.amount, 0);

    result['EMPLOYER_CONTRIBUTIONS_TOTAL'] = lines
      .filter((l) => l.bucket === 'employer_contribution' || l.bucket === 'employer_levy')
      .reduce((sum, l) => sum + l.amount, 0);

    return result;
  }

  private sumBucket(lines: PayrollResultLine[], bucket: PayrollResultLine['bucket']): number {
    return lines.filter((l) => l.bucket === bucket).reduce((sum, l) => sum + l.amount, 0);
  }
}
