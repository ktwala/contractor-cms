import { Injectable } from '@nestjs/common';
import { LS_PAYE_2025_2026_DEFAULT } from './ls-paye-2025-2026.template';
import { ZA_PAYE_2025_2026_DEFAULT } from './za-paye-2025-2026.template';
import type { TaxTableTemplate, TaxTableTemplateCardDto } from './tax-table-template.types';

@Injectable()
export class TaxTableTemplateRegistry {
  private readonly templates: TaxTableTemplate[] = [
    LS_PAYE_2025_2026_DEFAULT,
    ZA_PAYE_2025_2026_DEFAULT,
  ];

  listAvailable(): TaxTableTemplate[] {
    return this.templates.filter((t) => t.status === 'ACTIVE');
  }

  listByCountry(countryCode: string): TaxTableTemplate[] {
    return this.templates.filter(
      (t) => t.countryCode === countryCode && t.status === 'ACTIVE',
    );
  }

  has(countryCode: string, tableType: string, taxYear: string): boolean {
    return !!this.get(countryCode, tableType, taxYear);
  }

  get(countryCode: string, tableType: string, taxYear: string): TaxTableTemplate | null {
    return (
      this.templates.find(
        (t) =>
          t.countryCode === countryCode &&
          t.tableType === tableType &&
          t.taxYear === taxYear &&
          t.status === 'ACTIVE',
      ) ?? null
    );
  }

  getById(templateId: string): TaxTableTemplate | null {
    return this.templates.find((t) => t.templateId === templateId) ?? null;
  }

  getRecommended(countryCode: string, tableType: string, taxYear: string): TaxTableTemplate | null {
    return this.get(countryCode, tableType, taxYear);
  }

  listAll(): TaxTableTemplate[] {
    return [...this.templates];
  }

  toCardDto(template: TaxTableTemplate, recommended = false): TaxTableTemplateCardDto {
    return {
      templateId: template.templateId,
      templateCode: template.templateCode,
      title: template.title,
      description: template.description,
      countryCode: template.countryCode,
      tableType: template.tableType,
      taxYear: template.taxYear,
      version: template.version,
      sourceReference: template.sourceReference,
      defaultEffectiveFrom: template.defaultEffectiveFrom,
      bracketCount: template.brackets.length,
      includedFieldLabels: template.supplementalFields
        .filter((f) => f.required)
        .map((f) => f.label),
      recommended,
      status: template.status,
    };
  }
}
