import { TaxTableTemplate } from './tax-table-template.types';

export const ZA_PAYE_2025_2026_DEFAULT: TaxTableTemplate = {
  templateId: 'tmpl-za-paye-2025-2026-v1',
  templateCode: 'ZA_PAYE_2025_2026_DEFAULT',
  countryCode: 'ZA',
  tableType: 'PAYE',
  taxYear: '2025/2026',

  title: 'South Africa PAYE 2025/2026',
  description: 'Official default South Africa PAYE table with age-based rebates and thresholds.',

  status: 'ACTIVE',
  version: '1.0.0',

  sourceReference: 'SARS Budget 2025',
  sourceUrl: null,
  sourceChecksum: null,

  defaultEffectiveFrom: '2025-03-01',
  defaultEffectiveTo: null,

  supportedCreationMethods: ['template', 'copy', 'import'],

  brackets: [
    { seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, isOpenEnded: false },
    { seqNo: 2, bracketFrom: 237100, bracketTo: 370500, marginalRate: 0.26, baseTax: 42678, isOpenEnded: false },
    { seqNo: 3, bracketFrom: 370500, bracketTo: 512800, marginalRate: 0.31, baseTax: 77362, isOpenEnded: false },
    { seqNo: 4, bracketFrom: 512800, bracketTo: 673000, marginalRate: 0.36, baseTax: 121475, isOpenEnded: false },
    { seqNo: 5, bracketFrom: 673000, bracketTo: 857900, marginalRate: 0.39, baseTax: 179147, isOpenEnded: false },
    { seqNo: 6, bracketFrom: 857900, bracketTo: 1817000, marginalRate: 0.41, baseTax: 251258, isOpenEnded: false },
    { seqNo: 7, bracketFrom: 1817000, bracketTo: null, marginalRate: 0.45, baseTax: 644489, isOpenEnded: true },
  ],

  supplementalFields: [
    {
      fieldCode: 'primary_rebate',
      fieldType: 'number',
      fieldValue: 17235,
      label: 'Primary Rebate',
      required: true,
      helpText: 'Applied to all qualifying taxpayers.',
    },
    {
      fieldCode: 'secondary_rebate',
      fieldType: 'number',
      fieldValue: 9444,
      label: 'Secondary Rebate (65-74)',
      required: true,
      helpText: 'Additional rebate for taxpayers aged 65 to 74.',
    },
    {
      fieldCode: 'tertiary_rebate',
      fieldType: 'number',
      fieldValue: 3145,
      label: 'Tertiary Rebate (75+)',
      required: true,
      helpText: 'Additional rebate for taxpayers aged 75 and above.',
    },
    {
      fieldCode: 'tax_threshold_under_65',
      fieldType: 'number',
      fieldValue: 95750,
      label: 'Tax Threshold (Under 65)',
      required: true,
      helpText: 'Income threshold below which PAYE is not payable for taxpayers under 65.',
    },
    {
      fieldCode: 'tax_threshold_65_to_74',
      fieldType: 'number',
      fieldValue: 148217,
      label: 'Tax Threshold (65-74)',
      required: true,
      helpText: 'Income threshold below which PAYE is not payable for taxpayers aged 65 to 74.',
    },
    {
      fieldCode: 'tax_threshold_75_plus',
      fieldType: 'number',
      fieldValue: 165689,
      label: 'Tax Threshold (75+)',
      required: true,
      helpText: 'Income threshold below which PAYE is not payable for taxpayers aged 75 and above.',
    },
  ],

  simulationDefaults: {
    incomes: [80000, 250000, 500000, 1200000],
    ages: [30, 67, 78],
  },

  compatibility: {
    packCodes: ['za-pack'],
    minimumPackVersions: ['2.0.0'],
  },

  createdAt: '2026-03-17T00:00:00Z',
  updatedAt: '2026-03-17T00:00:00Z',
};
