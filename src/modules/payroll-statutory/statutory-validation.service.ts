import { Injectable, Logger } from '@nestjs/common';
import { PayrollEmployeeResult } from '../payroll-results/payroll-result.types';
import { StatutoryReturnDefinition, CountryStatutoryProfile } from './statutory-profile.types';
import {
  UnmappedStatutoryLineError,
  InvalidPayrunStateError,
  StatutoryReturnGenerationError,
} from './statutory.errors';

const ELIGIBLE_PAYRUN_STATUSES = new Set([
  'CALCULATED',
  'IN_REVIEW',
  'APPROVED',
  'PAID',
  'POSTED',
  'FINALIZED',
  'SUBMITTED',
]);

@Injectable()
export class StatutoryValidationService {
  private readonly logger = new Logger(StatutoryValidationService.name);

  validatePayrunEligibility(payrunId: string, status: string): void {
    if (!ELIGIBLE_PAYRUN_STATUSES.has(status)) {
      throw new InvalidPayrunStateError(payrunId, status);
    }
  }

  validateResultsExist(results: PayrollEmployeeResult[]): void {
    if (!results || results.length === 0) {
      throw new StatutoryReturnGenerationError(
        'No normalized payroll results found for this payrun',
      );
    }
  }

  validateMappedStatutoryLines(
    results: PayrollEmployeeResult[],
    definition: StatutoryReturnDefinition,
  ): void {
    const mappedCodes = new Set(
      definition.line_mappings.flatMap((m) => m.result_line_codes),
    );

    const unmapped = new Set<string>();
    for (const r of results) {
      for (const line of r.lines) {
        if (line.is_statutory && !mappedCodes.has(line.code)) {
          unmapped.add(line.code);
        }
      }
    }

    if (unmapped.size > 0) {
      throw new UnmappedStatutoryLineError(Array.from(unmapped));
    }
  }

  validateContextConsistency(
    results: PayrollEmployeeResult[],
    expectedCountry: string,
    expectedCurrency: string,
  ): void {
    for (const r of results) {
      if (r.country_code !== expectedCountry) {
        throw new StatutoryReturnGenerationError(
          `Employee ${r.employee_id} has country ${r.country_code} but expected ${expectedCountry}`,
        );
      }
      if (r.currency !== expectedCurrency) {
        throw new StatutoryReturnGenerationError(
          `Employee ${r.employee_id} has currency ${r.currency} but expected ${expectedCurrency}`,
        );
      }
    }
  }

  validateHiddenStatutoryLines(results: PayrollEmployeeResult[]): void {
    for (const r of results) {
      for (const line of r.lines) {
        if (line.is_statutory && line.visibility === 'hidden') {
          this.logger.warn(
            `Statutory line ${line.code} is hidden for employee ${r.employee_id} — defense-in-depth check`,
          );
          throw new StatutoryReturnGenerationError(
            `Statutory line ${line.code} has visibility 'hidden' for employee ${r.employee_id}. Statutory items must not be hidden.`,
          );
        }
      }
    }
  }

  validateAll(
    payrunId: string,
    payrunStatus: string,
    results: PayrollEmployeeResult[],
    profile: CountryStatutoryProfile,
    definition: StatutoryReturnDefinition,
    expectedCountry: string,
    expectedCurrency: string,
  ): void {
    this.validatePayrunEligibility(payrunId, payrunStatus);
    this.validateResultsExist(results);
    this.validateContextConsistency(results, expectedCountry, expectedCurrency);
    this.validateHiddenStatutoryLines(results);
    this.validateMappedStatutoryLines(results, definition);
  }
}
