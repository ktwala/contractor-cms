import { Injectable, Logger } from '@nestjs/common';
import { PayrollEmployeeResult } from '../payroll-results/payroll-result.types';
import { StatutoryReturnDto, StatutoryArtifactDto } from './statutory.types';
import { StatutoryRepository } from './repository/statutory.repository';

@Injectable()
export class StatutoryEvidenceService {
  private readonly logger = new Logger(StatutoryEvidenceService.name);

  constructor(private readonly repository: StatutoryRepository) {}

  async generateBundle(
    returnDto: StatutoryReturnDto,
    persistedReturnId: string,
    results: PayrollEmployeeResult[],
    userId?: string,
  ) {
    const artifacts: StatutoryArtifactDto[] = [];

    artifacts.push(this.buildSummaryJson(returnDto));
    artifacts.push(this.buildEmployeeScheduleCsv(returnDto, results));

    const bundle = await this.repository.createEvidenceBundle({
      statutoryReturnId: persistedReturnId,
      countryCode: returnDto.country_code,
      returnCode: returnDto.return_code,
      periodKey: returnDto.period_key,
      legalEntityId: returnDto.legal_entity_id,
      artifacts,
      createdByUserId: userId,
      metadata: {
        display_schema_key: returnDto.display_schema_key,
        statutory_profile_key: returnDto.statutory_profile_key,
        country_pack_version: returnDto.country_pack_version,
        generated_at: returnDto.generated_at,
      },
    });

    this.logger.log(`Evidence bundle ${bundle.id} created for return ${persistedReturnId}`);
    return bundle;
  }

  private buildSummaryJson(returnDto: StatutoryReturnDto): StatutoryArtifactDto {
    const content = JSON.stringify(
      {
        return_code: returnDto.return_code,
        return_label: returnDto.return_label,
        country_code: returnDto.country_code,
        period_key: returnDto.period_key,
        currency: returnDto.currency,
        total_due: returnDto.total_due,
        employee_count: returnDto.employee_count,
        items: returnDto.items.map((i) => ({
          item_code: i.item_code,
          item_label: i.item_label,
          amount: i.amount,
          employee_count: i.employee_count,
        })),
        statutory_profile_key: returnDto.statutory_profile_key,
        display_schema_key: returnDto.display_schema_key,
        country_pack_version: returnDto.country_pack_version,
        generated_at: returnDto.generated_at,
      },
      null,
      2,
    );

    return {
      type: 'summary_json',
      name: `${returnDto.return_code}_${returnDto.period_key}_summary.json`,
      mime_type: 'application/json',
      size_bytes: Buffer.byteLength(content, 'utf-8'),
      content,
    };
  }

  private buildEmployeeScheduleCsv(
    returnDto: StatutoryReturnDto,
    results: PayrollEmployeeResult[],
  ): StatutoryArtifactDto {
    const headers = [
      'employee_id',
      'employee_code',
      'employee_name',
      'return_code',
      'item_code',
      'item_label',
      'line_code',
      'line_label',
      'amount',
      'country_code',
      'period_key',
      'source_payrun_id',
      'country_pack_version',
      'display_schema_key',
      'statutory_profile_key',
    ];

    const mappedCodes = new Set(
      returnDto.items.flatMap((i) => i.source_line_codes),
    );

    const rows: string[] = [headers.join(',')];

    for (const emp of results) {
      for (const line of emp.lines) {
        if (!line.is_statutory || !mappedCodes.has(line.code)) continue;

        const itemMatch = returnDto.items.find((i) =>
          i.source_line_codes.includes(line.code),
        );

        rows.push(
          [
            emp.employee_id,
            emp.employee_code ?? '',
            `"${(emp.employee_name ?? '').replace(/"/g, '""')}"`,
            returnDto.return_code,
            itemMatch?.item_code ?? '',
            `"${(itemMatch?.item_label ?? '').replace(/"/g, '""')}"`,
            line.code,
            `"${line.label.replace(/"/g, '""')}"`,
            Number(line.period_amount ?? line.amount).toFixed(2),
            returnDto.country_code,
            returnDto.period_key,
            returnDto.source_payrun_ids[0] ?? '',
            returnDto.country_pack_version ?? '',
            returnDto.display_schema_key ?? '',
            returnDto.statutory_profile_key,
          ].join(','),
        );
      }
    }

    const content = rows.join('\n');

    return {
      type: 'employee_schedule_csv',
      name: `${returnDto.return_code}_${returnDto.period_key}_employee_schedule.csv`,
      mime_type: 'text/csv',
      size_bytes: Buffer.byteLength(content, 'utf-8'),
      content,
    };
  }
}
