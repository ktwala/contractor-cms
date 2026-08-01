export type TaxTableAuthoringStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type TaxTableAuthoringSourceType =
  | 'TEMPLATE'
  | 'COPY'
  | 'IMPORT'
  | 'MANUAL';

export interface AuthoringBracketInput {
  seqNo: number;
  bracketFrom: number;
  bracketTo: number | null;
  marginalRate: number;
  baseTax: number;
  isOpenEnded: boolean;
  baseTaxOverrideReason?: string;
}

export interface AuthoringFieldInput {
  fieldCode: string;
  fieldValue: unknown;
}

export interface AuthoringDraft {
  id: string;
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: TaxTableAuthoringStatus;
  sourceType: TaxTableAuthoringSourceType;
  sourceReference: string | null;
  sourceChecksum: string | null;
  templateId: string | null;
  templateCode: string | null;
  templateVersion: string | null;
  copiedFromAuthoringId: string | null;
  publishedTaxTableSetId: string | null;
  createdByUserId: string;
  reviewedByUserId: string | null;
  publishedByUserId: string | null;
  publishReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  brackets: AuthoringBracketRow[];
  fields: AuthoringFieldRow[];
}

export interface AuthoringBracketRow {
  id: string;
  seqNo: number;
  bracketFrom: number;
  bracketTo: number | null;
  marginalRate: number;
  baseTax: number;
  derivedBaseTax: number | null;
  isOpenEnded: boolean;
  baseTaxOverrideReason: string | null;
}

export interface AuthoringFieldRow {
  id: string;
  fieldCode: string;
  fieldValue: unknown;
}

export interface TemplateDefinition {
  templateId: string;
  countryCode: string;
  tableType: string;
  taxYear: string;
  compatiblePackCodes: string[];
  sourceReference: string;
  brackets: AuthoringBracketInput[];
  supplemental: Record<string, unknown>;
}

export interface BracketDiffEntry {
  seqNo: number;
  field: string;
  previous: unknown;
  current: unknown;
}

export interface FieldDiffEntry {
  fieldCode: string;
  previous: unknown;
  current: unknown;
}

export interface AuthoringDiffResult {
  metadataChanges: Array<{ field: string; previous: unknown; current: unknown }>;
  bracketChanges: BracketDiffEntry[];
  fieldChanges: FieldDiffEntry[];
  bracketsAdded: number;
  bracketsRemoved: number;
}

export interface SimulationInput {
  annualIncomes: number[];
  periodsPerYear?: number;
  age?: number;
}

export interface SimulationResultRow {
  annualIncome: number;
  annualTax: number;
  effectiveRate: number;
  monthlyTax: number;
  bracketUsed: number;
}

export interface ResolvedRoutingResult {
  countryCode: 'ZA' | 'LS';
  legalEntityId?: string | null;
  computeDate: string;
  runType: string;

  pack: {
    packCode: string;
    version: string;
    registryId: string;
    checksum?: string | null;
  };

  taxTableSet: {
    id: string;
    tableType: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    status: 'ACTIVE';
    checksum?: string | null;
    sourceReference?: string | null;
    sourceType?: string | null;
    authoringVersionId?: string | null;
  };

  statutoryConfigs: Array<{
    id: string;
    configType: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    checksum?: string | null;
  }>;

  checksums: Record<string, string>;
  overrides?: {
    packVersionPinned?: boolean;
    taxTableSetPinned?: boolean;
    reason?: string | null;
  };
}
