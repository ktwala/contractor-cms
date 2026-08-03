import { DataImportDatasetType } from '@prisma/client';

export const DATASET_ORDER: DataImportDatasetType[] = [
  'LEGAL_ENTITIES',
  'PAY_GROUPS',
  'ORG_UNITS',
  'COST_CENTERS',
  'POSITIONS',
  'EMPLOYEES',
  'EMPLOYMENTS',
  'EMPLOYMENT_ASSIGNMENTS',
  'MANAGER_RELATIONSHIPS',
];

export const DATASET_DEPENDENCIES: Partial<Record<DataImportDatasetType, DataImportDatasetType[]>> = {
  PAY_GROUPS: ['LEGAL_ENTITIES'],
  ORG_UNITS: ['LEGAL_ENTITIES'],
  COST_CENTERS: ['LEGAL_ENTITIES'],
  POSITIONS: ['ORG_UNITS'],
  EMPLOYMENTS: ['EMPLOYEES', 'LEGAL_ENTITIES'],
  EMPLOYMENT_ASSIGNMENTS: ['EMPLOYMENTS', 'ORG_UNITS', 'COST_CENTERS'],
  MANAGER_RELATIONSHIPS: ['EMPLOYEES'],
};

export const SHEET_TO_DATASET: Record<string, DataImportDatasetType> = {
  legalentities: 'LEGAL_ENTITIES',
  legal_entities: 'LEGAL_ENTITIES',
  paygroups: 'PAY_GROUPS',
  pay_groups: 'PAY_GROUPS',
  orgunits: 'ORG_UNITS',
  org_units: 'ORG_UNITS',
  costcenters: 'COST_CENTERS',
  cost_centers: 'COST_CENTERS',
  positions: 'POSITIONS',
  employees: 'EMPLOYEES',
  employments: 'EMPLOYMENTS',
  assignments: 'EMPLOYMENT_ASSIGNMENTS',
  employment_assignments: 'EMPLOYMENT_ASSIGNMENTS',
  employmentassignments: 'EMPLOYMENT_ASSIGNMENTS',
  managers: 'MANAGER_RELATIONSHIPS',
  employee_managers: 'MANAGER_RELATIONSHIPS',
  employeemanagers: 'MANAGER_RELATIONSHIPS',
  manager_relationships: 'MANAGER_RELATIONSHIPS',
};

export interface DetectedDataset {
  datasetType: DataImportDatasetType;
  source: string;
  rowCount: number;
  status: 'ready' | 'warning' | 'blocked';
  blockReason?: string;
}

export interface BootstrapUploadResult {
  bootstrap_import_id: string;
  file_type: 'XLSX' | 'ZIP';
  datasets_detected: string[];
  datasets: DetectedDataset[];
  row_counts: Record<string, number>;
  warnings: string[];
  missing_required: string[];
  blocked: boolean;
}

export interface DatasetValidationResult {
  dataset: string;
  status: 'VALID' | 'VALID_WITH_WARNINGS' | 'HAS_ERRORS';
  errors: number;
  warnings: number;
  rows: number;
}

export interface BootstrapValidationResult {
  bootstrap_import_id: string;
  status: 'VALIDATED' | 'HAS_ERRORS';
  datasets: DatasetValidationResult[];
}

export interface DatasetImportResult {
  dataset: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface BootstrapRunResult {
  bootstrap_import_id: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED';
  results: DatasetImportResult[];
  warnings: string[];
  errors: string[];
  report: string[];
}
