/**
 * Phase 2 reserved capabilities — not yet routed but registered to prevent drift.
 *
 * payroll:ctc_optimiser:approve — will gate the approval workflow when
 * SoD-style governance is introduced. The string is already in the P
 * constants and seeded, but no controller endpoint uses it yet.
 * Adding it later requires only wiring, not a new migration.
 */

export const CTC_AUDIT_EVENTS = {
  RUN: 'CTC_OPTIMISER_RUN',
  SCENARIO_BLOCKED: 'CTC_OPTIMISER_SCENARIO_BLOCKED',
  SCENARIO_SELECTED: 'CTC_OPTIMISER_SCENARIO_SELECTED',
  APPROVED: 'CTC_OPTIMISER_APPROVED',
  APPLIED: 'CTC_OPTIMISER_APPLIED',
  OVERRIDE_ACKNOWLEDGED: 'CTC_OPTIMISER_OVERRIDE_ACKNOWLEDGED',
} as const;

export const CTC_BLOCKED_CODES = {
  COUNTRY_PACK_NOT_FOUND: 'PAYROLL_CTC_OPTIMISER_COUNTRY_PACK_NOT_FOUND',
  TAX_TABLES_MISSING: 'PAYROLL_CTC_OPTIMISER_TAX_TABLES_MISSING',
  POLICY_BLOCKED: 'PAYROLL_CTC_OPTIMISER_POLICY_BLOCKED',
} as const;

export const CTC_PRESETS = [
  {
    name: 'Executive balanced',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    ctc: 120000,
    optimisationMode: 'TARGET_NET' as const,
    targetNet: 80000,
    medicalAid: { amount: 15000, beneficiaries: 2 },
    retirement: { minAmount: 5000, targetAmount: 10000 },
    travel: { enabled: true, maxPercent: 25 },
    reimbursive: { enabled: true, maxAmount: 5000 },
    constraints: {
      minBasicPercent: 55,
      maxAllowancePercent: 35,
      requireMedicalAidAsEmployerContribution: true,
      requireRetirementFund: true,
    },
  },
  {
    name: 'Cash maximiser',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    ctc: 80000,
    optimisationMode: 'MAX_NET' as const,
    targetNet: undefined,
    medicalAid: { amount: 8000, beneficiaries: 1 },
    retirement: { minAmount: 0, targetAmount: 0 },
    travel: { enabled: true, maxPercent: 30 },
    reimbursive: { enabled: true, maxAmount: 3000 },
    constraints: {
      minBasicPercent: 50,
      maxAllowancePercent: 40,
      requireMedicalAidAsEmployerContribution: false,
      requireRetirementFund: false,
    },
  },
  {
    name: 'Retirement focused',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    ctc: 100000,
    optimisationMode: 'BALANCED' as const,
    targetNet: undefined,
    medicalAid: { amount: 12000, beneficiaries: 2 },
    retirement: { minAmount: 10000, targetAmount: 20000 },
    travel: { enabled: false, maxPercent: 0 },
    reimbursive: { enabled: false, maxAmount: 0 },
    constraints: {
      minBasicPercent: 60,
      maxAllowancePercent: 25,
      requireMedicalAidAsEmployerContribution: true,
      requireRetirementFund: true,
    },
  },
  {
    name: 'Medical-heavy family package',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    ctc: 90000,
    optimisationMode: 'TARGET_NET' as const,
    targetNet: 55000,
    medicalAid: { amount: 20000, beneficiaries: 4 },
    retirement: { minAmount: 5000, targetAmount: 8000 },
    travel: { enabled: true, maxPercent: 15 },
    reimbursive: { enabled: false, maxAmount: 0 },
    constraints: {
      minBasicPercent: 55,
      maxAllowancePercent: 30,
      requireMedicalAidAsEmployerContribution: true,
      requireRetirementFund: true,
    },
  },
];
