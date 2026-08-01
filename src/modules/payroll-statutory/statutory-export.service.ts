import { Injectable, NotFoundException } from '@nestjs/common';
import { StatutoryRepository } from './repository/statutory.repository';
import { StatutoryProfileRegistry } from './statutory-profile.registry';

export interface ExportResult {
  filename: string;
  mime_type: string;
  content: string | Buffer;
}

@Injectable()
export class StatutoryExportService {
  constructor(
    private readonly repository: StatutoryRepository,
    private readonly profileRegistry: StatutoryProfileRegistry,
  ) {}

  async exportReturn(
    returnId: string,
    format: 'json' | 'csv' | 'xlsx' | 'pdf',
  ): Promise<ExportResult> {
    const ret = await this.repository.getReturnById(returnId);
    if (!ret) throw new NotFoundException(`Statutory return ${returnId} not found`);

    const profile = this.profileRegistry.get(ret.countryCode);
    const definition = profile.supported_returns.find(
      (d) => d.return_code === ret.returnCode,
    );
    if (definition && !definition.output_formats.includes(format)) {
      throw new NotFoundException(
        `Export format '${format}' is not supported for ${ret.returnCode}`,
      );
    }

    switch (format) {
      case 'json':
        return this.exportJson(ret);
      case 'csv':
        return this.exportCsv(ret);
      case 'xlsx':
        return this.exportXlsxPlaceholder(ret);
      case 'pdf':
        return this.exportPdfPlaceholder(ret);
      default:
        throw new NotFoundException(`Unsupported export format: ${format}`);
    }
  }

  private exportJson(ret: any): ExportResult {
    const data = {
      id: ret.id,
      return_code: ret.returnCode,
      return_label: ret.returnLabel,
      country_code: ret.countryCode,
      legal_entity_id: ret.legalEntityId,
      period_key: ret.periodKey,
      period_start: ret.periodStart,
      period_end: ret.periodEnd,
      currency: ret.currency,
      status: ret.status,
      total_due: Number(ret.totalDue),
      employee_count: ret.employeeCount,
      source_payrun_ids: ret.sourcePayrunIds,
      display_schema_key: ret.displaySchemaKey,
      statutory_profile_key: ret.statutoryProfileKey,
      country_pack_version: ret.countryPackVersion,
      generated_at: ret.generatedAt,
      items: ret.items.map((i: any) => ({
        item_code: i.itemCode,
        item_label: i.itemLabel,
        amount: Number(i.amount),
        currency: i.currency,
        source_line_codes: i.sourceLineCodes,
        employee_count: i.employeeCount,
        sort_order: i.sortOrder,
      })),
    };

    return {
      filename: `${ret.returnCode}_${ret.periodKey}.json`,
      mime_type: 'application/json',
      content: JSON.stringify(data, null, 2),
    };
  }

  private exportCsv(ret: any): ExportResult {
    const headers = [
      'item_code',
      'item_label',
      'amount',
      'currency',
      'employee_count',
      'source_line_codes',
    ];
    const rows = [headers.join(',')];

    for (const item of ret.items) {
      rows.push(
        [
          item.itemCode,
          `"${item.itemLabel}"`,
          Number(item.amount).toFixed(2),
          item.currency,
          item.employeeCount ?? '',
          `"${(item.sourceLineCodes as string[]).join(';')}"`,
        ].join(','),
      );
    }

    const totalRow = [
      'TOTAL',
      '"Total Due"',
      Number(ret.totalDue).toFixed(2),
      ret.currency,
      ret.employeeCount,
      '""',
    ].join(',');
    rows.push(totalRow);

    return {
      filename: `${ret.returnCode}_${ret.periodKey}.csv`,
      mime_type: 'text/csv',
      content: rows.join('\n'),
    };
  }

  private exportXlsxPlaceholder(ret: any): ExportResult {
    return this.exportCsv(ret);
  }

  private exportPdfPlaceholder(ret: any): ExportResult {
    const lines = [
      `STATUTORY RETURN: ${ret.returnLabel}`,
      `Return Code: ${ret.returnCode}`,
      `Country: ${ret.countryCode}`,
      `Period: ${ret.periodKey}`,
      `Currency: ${ret.currency}`,
      `Total Due: ${Number(ret.totalDue).toFixed(2)}`,
      `Employee Count: ${ret.employeeCount}`,
      `Status: ${ret.status}`,
      `Profile: ${ret.statutoryProfileKey}`,
      `Pack Version: ${ret.countryPackVersion ?? 'N/A'}`,
      '',
      'ITEMS:',
      ...ret.items.map(
        (i: any) =>
          `  ${i.itemCode}: ${i.itemLabel} = ${Number(i.amount).toFixed(2)} ${i.currency} (${i.employeeCount ?? 0} employees)`,
      ),
    ];

    return {
      filename: `${ret.returnCode}_${ret.periodKey}_review.txt`,
      mime_type: 'text/plain',
      content: lines.join('\n'),
    };
  }
}
