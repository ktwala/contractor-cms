export interface PackManifest {
  pack_type?: string;
  customer_name?: string;
  country?: string;
  version?: string;
  datasets?: string[];
}

export const PACK_DATASET_ORDER = [
  'LEGAL_ENTITIES',
  'PAY_GROUPS',
  'ORG_UNITS',
  'COST_CENTERS',
  'POSITIONS',
  'EMPLOYEES',
  'EMPLOYMENTS',
  'EMPLOYMENT_ASSIGNMENTS',
  'MANAGER_RELATIONSHIPS',
] as const;

export const FILENAME_TO_DATASET: Record<string, (typeof PACK_DATASET_ORDER)[number]> = {
  legal_entities_csv: 'LEGAL_ENTITIES',
  'legal_entities.csv': 'LEGAL_ENTITIES',
  pay_groups_csv: 'PAY_GROUPS',
  'pay_groups.csv': 'PAY_GROUPS',
  org_units_csv: 'ORG_UNITS',
  'org_units.csv': 'ORG_UNITS',
  cost_centers_csv: 'COST_CENTERS',
  'cost_centers.csv': 'COST_CENTERS',
  positions_csv: 'POSITIONS',
  'positions.csv': 'POSITIONS',
  employees_csv: 'EMPLOYEES',
  'employees.csv': 'EMPLOYEES',
  employments_csv: 'EMPLOYMENTS',
  'employments.csv': 'EMPLOYMENTS',
  employment_assignments_csv: 'EMPLOYMENT_ASSIGNMENTS',
  'employment_assignments.csv': 'EMPLOYMENT_ASSIGNMENTS',
  employee_managers_csv: 'MANAGER_RELATIONSHIPS',
  'employee_managers.csv': 'MANAGER_RELATIONSHIPS',
  managers_csv: 'MANAGER_RELATIONSHIPS',
  'managers.csv': 'MANAGER_RELATIONSHIPS',
  manager_relationships_csv: 'MANAGER_RELATIONSHIPS',
  'manager_relationships.csv': 'MANAGER_RELATIONSHIPS',
};

function normalizeFilename(name: string): string {
  return name.toLowerCase().replace(/[-\s]/g, '_').replace(/\.csv$/i, '');
}

export function resolveDatasetFromFilename(filename: string): (typeof PACK_DATASET_ORDER)[number] | null {
  const base = filename.split('/').pop() ?? filename;
  const key1 = base.toLowerCase();
  const key2 = normalizeFilename(base) + '_csv';
  return FILENAME_TO_DATASET[key1] ?? FILENAME_TO_DATASET[key2] ?? null;
}
