import { Injectable } from '@nestjs/common';
import { TaxTableImpactAnalysisRunRepository } from './tax-table-impact-analysis-run.repository';
import { TtaException, TTA_ERROR_CODES } from '../tax-table-authoring/types/error-codes';

@Injectable()
export class TaxTableImpactAnalysisExportService {
  constructor(
    private readonly runRepository: TaxTableImpactAnalysisRunRepository,
  ) {}

  async exportCsv(runId: string): Promise<{
    filename: string;
    contentType: string;
    content: string;
  }> {
    const run = await this.runRepository.getRun(runId);
    if (!run) {
      throw new TtaException(
        TTA_ERROR_CODES.IMPACT_RUN_NOT_FOUND,
        'Impact analysis run not found',
        undefined,
        404,
      );
    }

    const header = [
      'run_id',
      'authoring_version_id',
      'country_code',
      'employee_id',
      'employee_number',
      'employee_name',
      'legal_entity_name',
      'pay_group_name',
      'taxable_earnings',
      'baseline_paye',
      'draft_paye',
      'delta_paye',
      'absolute_delta',
      'direction',
      'baseline_bracket_label',
      'draft_bracket_label',
    ];

    const rows = run.rows.map((row) => [
      run.id,
      run.authoringVersionId,
      run.countryCode,
      row.employeeId,
      row.employeeNumber ?? '',
      row.employeeName ?? '',
      row.legalEntityName ?? '',
      row.payGroupName ?? '',
      String(row.taxableEarnings),
      String(row.baselinePaye),
      String(row.draftPaye),
      String(row.deltaPaye),
      String(row.absoluteDelta),
      row.direction,
      row.baselineBracketLabel ?? '',
      row.draftBracketLabel ?? '',
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map(this.escapeCsv).join(','))
      .join('\n');

    return {
      filename: `tax_table_impact_analysis_${run.countryCode}_${run.id}.csv`,
      contentType: 'text/csv',
      content: csv,
    };
  }

  private escapeCsv(value: string): string {
    const s = value ?? '';
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}
