import { Injectable } from '@nestjs/common';
import { CountryPayrollDisplaySchema } from './payroll-result.types';

export const LESOTHO_DISPLAY_SCHEMA_V1: CountryPayrollDisplaySchema = {
  schema_key: 'LS.v1',
  country_code: 'LS',
  version: 1,
  summary_columns: [
    { key: 'employee',              label: 'Employee',         source: 'employee_identity',                                    order: 10, visible: true, format: 'text',     align: 'left' },
    { key: 'gross',                 label: 'Gross',            source: 'core_field', core_field: 'gross',                       order: 20, visible: true, format: 'currency', align: 'right' },
    { key: 'taxable_income',        label: 'Taxable Income',   source: 'core_field', core_field: 'taxable_income',              order: 30, visible: true, format: 'currency', align: 'right' },
    { key: 'paye',                  label: 'PAYE',             source: 'summary_line', line_code: 'PAYE',                       order: 40, visible: true, format: 'currency', align: 'right' },
    { key: 'other_deductions_total', label: 'Other Deductions', source: 'summary_line', line_code: 'OTHER_DEDUCTIONS_TOTAL',    order: 50, visible: true, format: 'currency', align: 'right' },
    { key: 'net_pay',               label: 'Net Pay',          source: 'core_field', core_field: 'net_pay',                     order: 60, visible: true, format: 'currency', align: 'right' },
  ],
  detail_groups: [
    { key: 'earnings',             label: 'Earnings',                    include_buckets: ['earning'],                                                              order: 10 },
    { key: 'employee_statutory',   label: 'Statutory Deductions',        include_line_codes: ['PAYE'],                                                              order: 20 },
    { key: 'other_deductions',     label: 'Other Deductions',            include_buckets: ['employee_deduction'],  exclude_line_codes: ['PAYE'],                     order: 30 },
  ],
  totals_panel: {
    show_employee_deductions_total: true,
    show_employer_contributions_total: false,
    show_employer_levies_total: false,
    show_employer_cost: false,
    show_taxable_income: true,
  },
  exports: { include_hidden_lines: false, include_employer_items: false },
  payslip: { show_employer_section: false, show_taxable_income: true },
};

export const SOUTH_AFRICA_DISPLAY_SCHEMA_V1: CountryPayrollDisplaySchema = {
  schema_key: 'ZA.v1',
  country_code: 'ZA',
  version: 1,
  summary_columns: [
    { key: 'employee',              label: 'Employee',         source: 'employee_identity',                                    order: 10, visible: true, format: 'text',     align: 'left' },
    { key: 'gross',                 label: 'Gross',            source: 'core_field', core_field: 'gross',                       order: 20, visible: true, format: 'currency', align: 'right' },
    { key: 'paye',                  label: 'PAYE',             source: 'summary_line', line_code: 'PAYE',                       order: 30, visible: true, format: 'currency', align: 'right' },
    { key: 'uif_employee',          label: 'UIF',              source: 'summary_line', line_code: 'UIF_EMPLOYEE',               order: 40, visible: true, format: 'currency', align: 'right' },
    { key: 'other_deductions_total', label: 'Other Deductions', source: 'summary_line', line_code: 'OTHER_DEDUCTIONS_TOTAL',    order: 50, visible: true, format: 'currency', align: 'right' },
    { key: 'net_pay',               label: 'Net Pay',          source: 'core_field', core_field: 'net_pay',                     order: 60, visible: true, format: 'currency', align: 'right' },
  ],
  detail_groups: [
    { key: 'earnings',               label: 'Earnings',                        include_buckets: ['earning'],                                                                       order: 10 },
    { key: 'employee_statutory',     label: 'Employee Statutory Deductions',   include_line_codes: ['PAYE', 'UIF_EMPLOYEE'],                                                       order: 20 },
    { key: 'other_deductions',       label: 'Other Employee Deductions',       include_buckets: ['employee_deduction'],  exclude_line_codes: ['PAYE', 'UIF_EMPLOYEE'],               order: 30 },
    { key: 'employer_obligations',   label: 'Employer Contributions & Levies', include_buckets: ['employer_contribution', 'employer_levy'],                                         order: 40 },
  ],
  totals_panel: {
    show_employee_deductions_total: true,
    show_employer_contributions_total: true,
    show_employer_levies_total: true,
    show_employer_cost: true,
    show_taxable_income: true,
  },
  exports: { include_hidden_lines: false, include_employer_items: true },
  payslip: { show_employer_section: true, show_taxable_income: true },
};

@Injectable()
export class PayrollDisplaySchemaRegistry {
  private readonly schemas = new Map<string, CountryPayrollDisplaySchema>();

  constructor() {
    this.schemas.set('LS', LESOTHO_DISPLAY_SCHEMA_V1);
    this.schemas.set('ZA', SOUTH_AFRICA_DISPLAY_SCHEMA_V1);
  }

  get(countryCode: string): CountryPayrollDisplaySchema {
    const schema = this.schemas.get(countryCode);
    if (!schema) {
      throw new Error(`No payroll display schema registered for country ${countryCode}`);
    }
    return schema;
  }

  has(countryCode: string): boolean {
    return this.schemas.has(countryCode);
  }

  register(schema: CountryPayrollDisplaySchema): void {
    this.schemas.set(schema.country_code, schema);
  }
}
