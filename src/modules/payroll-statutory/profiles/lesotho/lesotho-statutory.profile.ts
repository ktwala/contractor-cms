import { CountryStatutoryProfile } from '../../statutory-profile.types';

export const LESOTHO_STATUTORY_PROFILE_V1: CountryStatutoryProfile = {
  country_code: 'LS',
  version: 1,
  profile_key: 'LS.STATUTORY.v1',
  supported_returns: [
    {
      return_code: 'LS_PAYE_MONTHLY',
      return_label: 'Lesotho Monthly PAYE Return',
      filing_frequency: 'monthly',
      requires_approval: true,
      requires_evidence_bundle: true,
      output_formats: ['json', 'csv', 'xlsx', 'pdf'],
      filing_due_rule: {
        day_of_month: 15,
        months_after_period: 1,
        authority: 'LRA',
      },
      line_mappings: [
        {
          result_line_codes: ['PAYE'],
          return_item_code: 'PAYE_TOTAL',
          return_item_label: 'PAYE',
          aggregation: 'sum',
          sort_order: 10,
        },
      ],
    },
  ],
};
