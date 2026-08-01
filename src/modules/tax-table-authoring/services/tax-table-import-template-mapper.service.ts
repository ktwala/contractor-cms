import { Injectable } from '@nestjs/common';
import type { TaxTableTemplate } from '../templates';

export interface TaxTableImportWorkbookData {
  metadata: Array<Record<string, unknown>>;
  brackets: Array<Record<string, unknown>>;
  supplementalFields: Array<Record<string, unknown>>;
  instructions: Array<Record<string, unknown>>;
}

@Injectable()
export class TaxTableImportTemplateMapperService {
  mapTemplateToWorkbook(template: TaxTableTemplate): TaxTableImportWorkbookData {
    return {
      metadata: [
        {
          country_code: template.countryCode,
          table_type: template.tableType,
          tax_year: template.taxYear,
          effective_from: template.defaultEffectiveFrom,
          effective_to: template.defaultEffectiveTo ?? '',
          source_type: 'IMPORT',
          source_reference: template.sourceReference,
          source_url: template.sourceUrl ?? '',
          template_code: template.templateCode,
          template_version: template.version,
        },
      ],
      brackets: template.brackets.map((b) => ({
        seq_no: b.seqNo,
        bracket_from: b.bracketFrom,
        bracket_to: b.bracketTo ?? '',
        marginal_rate: b.marginalRate,
        base_tax: b.baseTax,
        is_open_ended: b.isOpenEnded ? 'TRUE' : 'FALSE',
      })),
      supplementalFields: template.supplementalFields.map((f) => ({
        field_code: f.fieldCode,
        field_value: f.fieldValue,
        label: f.label,
        required: f.required ? 'TRUE' : 'FALSE',
        help_text: f.helpText ?? '',
      })),
      instructions: [
        {
          section: 'How to use',
          message: 'Review metadata, brackets, and supplemental fields before upload.',
        },
        {
          section: 'Rates',
          message: 'Use decimal rates such as 0.18 instead of 18.',
        },
        {
          section: 'Final bracket',
          message: 'Leave bracket_to blank for the open-ended last bracket.',
        },
      ],
    };
  }
}
