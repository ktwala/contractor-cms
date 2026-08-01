import { Injectable } from '@nestjs/common';
import { PayrollEmployeeResult } from '../payroll-results/payroll-result.types';
import { StatutoryReturnDefinition } from './statutory-profile.types';
import { StatutoryReturnItemDto } from './statutory.types';
import * as crypto from 'crypto';

@Injectable()
export class StatutoryReturnAggregationService {
  buildItems(
    results: PayrollEmployeeResult[],
    definition: StatutoryReturnDefinition,
    currency: string,
  ): StatutoryReturnItemDto[] {
    return definition.line_mappings.map((mapping) => {
      const matchedResults = results.filter((r) =>
        r.lines.some((l) => mapping.result_line_codes.includes(l.code)),
      );

      const matchedLines = matchedResults.flatMap((r) =>
        r.lines.filter((l) => mapping.result_line_codes.includes(l.code)),
      );

      const amount = matchedLines.reduce(
        (sum, line) => sum + Number(line.period_amount ?? line.amount ?? 0),
        0,
      );

      const employeeIds = new Set(matchedResults.map((r) => r.employee_id));

      return {
        id: crypto.randomUUID(),
        item_code: mapping.return_item_code,
        item_label: mapping.return_item_label,
        amount: Math.round(amount * 100) / 100,
        currency,
        source_line_codes: mapping.result_line_codes,
        employee_count: employeeIds.size,
        sort_order: mapping.sort_order,
      };
    });
  }
}
