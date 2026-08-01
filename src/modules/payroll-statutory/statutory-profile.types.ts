export interface StatutoryReturnLineMapping {
  result_line_codes: string[];
  return_item_code: string;
  return_item_label: string;
  aggregation: 'sum';
  sort_order: number;
}

export interface FilingDueRule {
  /** Day of month the filing is due (e.g. 7 = 7th of next month) */
  day_of_month: number;
  /** Months after the period end the filing is due (typically 1 for "next month") */
  months_after_period: number;
  /** Name of the authority receiving the filing */
  authority: string;
}

export interface StatutoryReturnDefinition {
  return_code: string;
  return_label: string;
  filing_frequency: 'monthly' | 'annual' | 'ad_hoc';
  requires_approval: boolean;
  requires_evidence_bundle: boolean;
  output_formats: Array<'json' | 'csv' | 'xlsx' | 'pdf'>;
  line_mappings: StatutoryReturnLineMapping[];
  filing_due_rule?: FilingDueRule;
}

export interface CountryStatutoryProfile {
  country_code: string;
  version: number;
  profile_key: string;
  supported_returns: StatutoryReturnDefinition[];
}
