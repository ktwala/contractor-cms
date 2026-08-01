import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuthoringDraft, AuthoringBracketRow } from './types/authoring.types';
import { TTA_ERROR_CODES, TtaException } from './types/error-codes';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  field?: string;
}

const COUNTRY_REQUIRED_FIELDS: Record<string, string[]> = {
  ZA: ['primary_rebate', 'secondary_rebate', 'tertiary_rebate'],
  LS: ['annual_tax_credit'],
};

@Injectable()
export class TaxTableAuthoringValidationService {
  constructor(private readonly prisma: PrismaService) {}

  validateDraft(draft: AuthoringDraft): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    issues.push(...this.validateBracketContinuity(draft.brackets));
    issues.push(...this.validateBracketRates(draft.brackets));
    issues.push(...this.validateOpenEndedBracket(draft.brackets));
    issues.push(...this.validateDerivedBaseTax(draft.brackets));
    issues.push(...this.validateRequiredFields(draft.countryCode, draft.fields));

    return issues;
  }

  private validateBracketContinuity(brackets: AuthoringBracketRow[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (brackets.length === 0) {
      issues.push({ code: 'NO_BRACKETS', message: 'At least one bracket is required', severity: 'ERROR' });
      return issues;
    }

    const sorted = [...brackets].sort((a, b) => a.seqNo - b.seqNo);

    if (sorted[0].bracketFrom !== 0) {
      issues.push({
        code: 'BRACKET_GAP_AT_ZERO',
        message: `First bracket should start at 0, starts at ${sorted[0].bracketFrom}`,
        severity: 'ERROR',
        field: `brackets[${sorted[0].seqNo}].bracketFrom`,
      });
    }

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.bracketTo === null && !prev.isOpenEnded) {
        issues.push({
          code: 'BRACKET_NULL_TO_NOT_OPEN_ENDED',
          message: `Bracket seqNo=${prev.seqNo} has null bracketTo but is not marked as open-ended`,
          severity: 'ERROR',
          field: `brackets[${prev.seqNo}]`,
        });
      }

      if (prev.bracketTo !== null) {
        const gap = curr.bracketFrom - prev.bracketTo;
        if (gap > 1) {
          issues.push({
            code: 'BRACKET_GAP',
            message: `Gap between bracket seqNo=${prev.seqNo} (to: ${prev.bracketTo}) and seqNo=${curr.seqNo} (from: ${curr.bracketFrom})`,
            severity: 'ERROR',
            field: `brackets[${curr.seqNo}].bracketFrom`,
          });
        }
        if (gap < 0) {
          issues.push({
            code: 'BRACKET_OVERLAP',
            message: `Overlap between bracket seqNo=${prev.seqNo} (to: ${prev.bracketTo}) and seqNo=${curr.seqNo} (from: ${curr.bracketFrom})`,
            severity: 'ERROR',
            field: `brackets[${curr.seqNo}].bracketFrom`,
          });
        }
      }
    }

    return issues;
  }

  private validateBracketRates(brackets: AuthoringBracketRow[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const b of brackets) {
      if (b.marginalRate < 0 || b.marginalRate > 1) {
        issues.push({
          code: 'INVALID_RATE',
          message: `Bracket seqNo=${b.seqNo} has invalid marginal rate: ${b.marginalRate}`,
          severity: 'ERROR',
          field: `brackets[${b.seqNo}].marginalRate`,
        });
      }
      if (b.baseTax < 0) {
        issues.push({
          code: 'NEGATIVE_BASE_TAX',
          message: `Bracket seqNo=${b.seqNo} has negative base tax: ${b.baseTax}`,
          severity: 'ERROR',
          field: `brackets[${b.seqNo}].baseTax`,
        });
      }
    }

    return issues;
  }

  private validateOpenEndedBracket(brackets: AuthoringBracketRow[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (brackets.length === 0) return issues;

    const openEnded = brackets.filter((b) => b.isOpenEnded);
    if (openEnded.length === 0) {
      issues.push({
        code: 'NO_OPEN_ENDED_BRACKET',
        message: 'Tax table should have exactly one open-ended bracket (the highest)',
        severity: 'WARNING',
      });
    }
    if (openEnded.length > 1) {
      issues.push({
        code: 'MULTIPLE_OPEN_ENDED',
        message: 'Only one bracket should be open-ended',
        severity: 'ERROR',
      });
    }
    if (openEnded.length === 1) {
      const maxSeq = Math.max(...brackets.map((b) => b.seqNo));
      if (openEnded[0].seqNo !== maxSeq) {
        issues.push({
          code: 'OPEN_ENDED_NOT_LAST',
          message: 'The open-ended bracket must be the last bracket by seqNo',
          severity: 'ERROR',
        });
      }
    }

    return issues;
  }

  private validateDerivedBaseTax(brackets: AuthoringBracketRow[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const sorted = [...brackets].sort((a, b) => a.seqNo - b.seqNo);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.bracketTo === null) continue;

      const expectedBaseTax =
        prev.baseTax + prev.marginalRate * (prev.bracketTo - prev.bracketFrom);
      const rounded = Math.round(expectedBaseTax * 100) / 100;

      if (Math.abs(curr.baseTax - rounded) > 1) {
        const derivedOrOverridden = curr.baseTaxOverrideReason
          ? 'overridden'
          : 'may be incorrect';

        issues.push({
          code: 'BASE_TAX_MISMATCH',
          message: `Bracket seqNo=${curr.seqNo} baseTax=${curr.baseTax}, derived=${rounded} (${derivedOrOverridden})`,
          severity: curr.baseTaxOverrideReason ? 'WARNING' : 'ERROR',
          field: `brackets[${curr.seqNo}].baseTax`,
        });
      }
    }

    return issues;
  }

  private validateRequiredFields(
    countryCode: string,
    fields: Array<{ fieldCode: string; fieldValue: unknown }>,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const required = COUNTRY_REQUIRED_FIELDS[countryCode] ?? [];
    const present = new Set(fields.map((f) => f.fieldCode));

    for (const code of required) {
      if (!present.has(code)) {
        issues.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required supplemental field '${code}' is missing for country ${countryCode}`,
          severity: 'WARNING',
        });
      }
    }

    return issues;
  }

  async assertPublishable(draft: AuthoringDraft): Promise<void> {
    const issues = this.validateDraft(draft);
    const errors = issues.filter((i) => i.severity === 'ERROR');

    if (errors.length > 0) {
      throw new TtaException(
        TTA_ERROR_CODES.VALIDATION_FAILED,
        'Draft has validation errors and cannot be published',
        { errors },
      );
    }
  }

  async checkRuntimeOverlap(draft: AuthoringDraft): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const overlapping = await this.prisma.taxTableSet.findFirst({
      where: {
        country: draft.countryCode as any,
        tableType: draft.tableType as any,
        status: 'ACTIVE',
        effectiveFrom: { lte: draft.effectiveTo ?? new Date('9999-12-31') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: draft.effectiveFrom } },
        ],
      },
    });

    if (overlapping) {
      issues.push({
        code: 'RUNTIME_OVERLAP',
        message: `Active runtime TaxTableSet ${overlapping.id} (${overlapping.taxYear}) overlaps the effective range. It will be superseded on publish.`,
        severity: 'WARNING',
      });
    }

    return issues;
  }
}
