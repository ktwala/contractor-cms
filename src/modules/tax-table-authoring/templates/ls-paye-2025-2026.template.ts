import { TaxTableTemplate } from './tax-table-template.types';

export const LS_PAYE_2025_2026_DEFAULT: TaxTableTemplate = {
  templateId: 'tmpl-ls-paye-2025-2026-v1',
  templateCode: 'LS_PAYE_2025_2026_DEFAULT',
  countryCode: 'LS',
  tableType: 'PAYE',
  taxYear: '2025/2026',

  title: 'Lesotho PAYE 2025/2026',
  description: 'Official default Lesotho PAYE table with annual tax credit.',

  status: 'ACTIVE',
  version: '1.0.0',

  sourceReference: 'Lesotho Revenue Services',
  sourceUrl: null,
  sourceChecksum: null,

  defaultEffectiveFrom: '2025-04-01',
  defaultEffectiveTo: null,

  supportedCreationMethods: ['template', 'copy', 'import'],

  brackets: [
    {
      seqNo: 1,
      bracketFrom: 0,
      bracketTo: 237100,
      marginalRate: 0.18,
      baseTax: 0,
      isOpenEnded: false,
    },
    {
      seqNo: 2,
      bracketFrom: 237100,
      bracketTo: null,
      marginalRate: 0.30,
      baseTax: 42678,
      isOpenEnded: true,
    },
  ],

  supplementalFields: [
    {
      fieldCode: 'annual_tax_credit',
      fieldType: 'number',
      fieldValue: 11640,
      label: 'Annual Tax Credit',
      required: true,
      helpText: 'Annual tax credit used by the Lesotho PAYE calculation.',
    },
  ],

  simulationDefaults: {
    incomes: [60000, 150000, 300000, 600000],
  },

  compatibility: {
    packCodes: ['ls-pack'],
    minimumPackVersions: ['2025.1'],
  },

  createdAt: '2026-03-17T00:00:00Z',
  updatedAt: '2026-03-17T00:00:00Z',
};
