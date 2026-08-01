import { CountryStatutoryProfile } from '../../statutory-profile.types';

export const SOUTH_AFRICA_STATUTORY_PROFILE_V1: CountryStatutoryProfile = {
  country_code: 'ZA',
  version: 1,
  profile_key: 'ZA.STATUTORY.v1',
  supported_returns: [
    {
      return_code: 'EMP201',
      return_label: 'EMP201 Monthly Employer Declaration',
      filing_frequency: 'monthly',
      requires_approval: true,
      requires_evidence_bundle: true,
      output_formats: ['json', 'csv', 'xlsx', 'pdf'],
      filing_due_rule: {
        day_of_month: 7,
        months_after_period: 1,
        authority: 'SARS',
      },
      line_mappings: [
        {
          result_line_codes: ['PAYE'],
          return_item_code: 'PAYE_TOTAL',
          return_item_label: 'PAYE',
          aggregation: 'sum',
          sort_order: 10,
        },
        {
          result_line_codes: ['UIF_EMPLOYEE'],
          return_item_code: 'UIF_EMPLOYEE_TOTAL',
          return_item_label: 'UIF Employee',
          aggregation: 'sum',
          sort_order: 20,
        },
        {
          result_line_codes: ['UIF_EMPLOYER'],
          return_item_code: 'UIF_EMPLOYER_TOTAL',
          return_item_label: 'UIF Employer',
          aggregation: 'sum',
          sort_order: 30,
        },
        {
          result_line_codes: ['SDL'],
          return_item_code: 'SDL_TOTAL',
          return_item_label: 'Skills Development Levy',
          aggregation: 'sum',
          sort_order: 40,
        },
      ],
    },
  ],
};
