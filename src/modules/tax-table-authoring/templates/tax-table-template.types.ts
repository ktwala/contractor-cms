export type TaxTableTemplateStatus = 'ACTIVE' | 'DEPRECATED' | 'DRAFT';

export type TaxTableTemplateFieldType = 'number' | 'string' | 'boolean' | 'json';

export type TaxTableSupportedCreationMethod = 'template' | 'copy' | 'import';

export interface TaxTableTemplateBracket {
  seqNo: number;
  bracketFrom: number;
  bracketTo: number | null;
  marginalRate: number;
  baseTax: number;
  isOpenEnded: boolean;
}

export interface TaxTableTemplateField {
  fieldCode: string;
  fieldType: TaxTableTemplateFieldType;
  fieldValue: unknown;
  label: string;
  required: boolean;
  helpText?: string;
}

export interface TaxTableTemplateSimulationDefaults {
  incomes: number[];
  ages?: number[];
}

export interface TaxTableTemplateCompatibility {
  packCodes: string[];
  minimumPackVersions?: string[];
}

export interface TaxTableTemplate {
  templateId: string;
  templateCode: string;
  countryCode: 'LS' | 'ZA';
  tableType: 'PAYE';
  taxYear: string;

  title: string;
  description?: string;

  status: TaxTableTemplateStatus;
  version: string;

  sourceReference: string;
  sourceUrl?: string | null;
  sourceChecksum?: string | null;

  defaultEffectiveFrom: string;
  defaultEffectiveTo?: string | null;

  supportedCreationMethods: TaxTableSupportedCreationMethod[];

  brackets: TaxTableTemplateBracket[];
  supplementalFields: TaxTableTemplateField[];

  simulationDefaults?: TaxTableTemplateSimulationDefaults;
  compatibility?: TaxTableTemplateCompatibility;

  createdAt: string;
  updatedAt: string;
}

export interface TaxTableTemplateCardDto {
  templateId: string;
  templateCode: string;
  title: string;
  description?: string;
  countryCode: 'LS' | 'ZA';
  tableType: 'PAYE';
  taxYear: string;
  version: string;
  sourceReference: string;
  defaultEffectiveFrom: string;
  bracketCount: number;
  includedFieldLabels: string[];
  recommended: boolean;
  status: TaxTableTemplateStatus;
}
