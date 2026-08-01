/**
 * Direct payroll compute for a CTC scenario using the real ZA engine.
 * Usage: npx ts-node scripts/compute-scenario.ts
 */
import { SouthAfricaComputePack } from '../src/country-packs/south-africa/south-africa-compute.pack';
import { PayrollComputeContext } from '../src/country-packs/interfaces/compute-contract.interface';

const taxData = {
  rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
  brackets: [
    { min: 0, max: 237100, rate: 0.18, base_amount: 0 },
    { min: 237100, max: 370500, rate: 0.26, base_amount: 42678 },
    { min: 370500, max: 512800, rate: 0.31, base_amount: 77362 },
    { min: 512800, max: 673000, rate: 0.36, base_amount: 121475 },
    { min: 673000, max: 857900, rate: 0.39, base_amount: 179147 },
    { min: 857900, max: 1817000, rate: 0.41, base_amount: 251258 },
    { min: 1817000, max: Infinity, rate: 0.45, base_amount: 644489 },
  ],
  thresholds: { under65: 95750, age65to74: 148217, age75plus: 165689 },
  periods_per_year: { MONTHLY: 12, WEEKLY: 52, BI_WEEKLY: 26, SEMI_MONTHLY: 24 },
};

const CTC = 120000;
const BASIC = 70000;
const TRAVEL = 20000;
const REIMBURSIVE = 5000;
const MEDICAL = 15000;
const RETIREMENT = 10000;

const ctx: PayrollComputeContext = {
  payrun: {
    payrun_id: 'manual-calc',
    payrun_type: 'REGULAR',
    country: 'ZA',
    currency: 'ZAR',
    legal_entity_id: 'manual',
    period: {
      start: '2026-03-01',
      end: '2026-03-31',
      pay_date: '2026-03-31',
      period_type: 'MONTHLY',
    },
  },
  tax_tables: {
    effective_from: '2025-03-01',
    brackets: taxData.brackets,
    meta: {
      ...taxData.rebates,
      rebates: taxData.rebates,
      thresholds: taxData.thresholds,
      periods_per_year: taxData.periods_per_year,
    },
  },
  employees: [
    {
      employee_id: 'test-employee',
      employment: { employment_type: 'PERMANENT', start_date: '2020-01-01' },
      tax_profile: {
        residency_status: 'RESIDENT',
        age: 35,
        meta: {
          medical_aid_members: 2,
          medical_scheme: { main_members: 1, dependants: 1 },
        },
      },
      inputs: {
        base_salary: BASIC,
        pay_items: [
          { code: 'BASIC_SALARY', type: 'EARNING', amount: BASIC, is_taxable: true, classification: 'BASIC_SALARY' as any },
          { code: 'TRAVEL_ALLOWANCE', type: 'EARNING', amount: TRAVEL, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' as any },
          { code: 'REIMB_TRAVEL', type: 'REIMBURSEMENT' as any, amount: REIMBURSIVE, is_taxable: false, classification: 'REIMBURSEMENT' as any },
          { code: 'MEDICAL_AID', type: 'DEDUCTION', amount: MEDICAL, is_taxable: false, classification: 'MEDICAL_AID_CONTRIBUTION' as any },
          { code: 'RETIREMENT_FUND', type: 'DEDUCTION', amount: RETIREMENT, is_taxable: false, classification: 'RETIREMENT_CONTRIBUTION' as any },
        ],
      },
    },
  ],
  rules: { ordered: [] },
  rounding_policy: { mode: 'HALF_UP', decimals: 2 },
};

async function main() {
  const pack = new SouthAfricaComputePack();
  const result = await pack.compute(ctx);
  const emp = result.employee_results[0];

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ZA PAYROLL COMPUTE — REAL ENGINE OUTPUT');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('  INPUT BREAKDOWN:');
  console.log(`    CTC (total):            R ${CTC.toLocaleString()}`);
  console.log(`    Basic Salary:           R ${BASIC.toLocaleString()}`);
  console.log(`    Travel Allowance:       R ${TRAVEL.toLocaleString()}`);
  console.log(`    Reimbursive Travel:     R ${REIMBURSIVE.toLocaleString()}`);
  console.log(`    Medical Aid:            R ${MEDICAL.toLocaleString()}`);
  console.log(`    Retirement Fund:        R ${RETIREMENT.toLocaleString()}`);
  console.log('');

  console.log('  COMPUTED TOTALS:');
  console.log(`    Gross Earnings:         R ${emp.totals.gross.toLocaleString()}`);
  console.log(`    Taxable Income:         R ${emp.totals.taxable_income.toLocaleString()}`);
  console.log(`    PAYE:                   R ${emp.totals.paye.toLocaleString()}`);
  console.log(`    Statutory Deductions:   R ${emp.totals.statutory_deductions.toLocaleString()}`);
  console.log(`    Other Deductions:       R ${emp.totals.other_deductions.toLocaleString()}`);
  console.log(`    Net Pay:                R ${emp.totals.net.toLocaleString()}`);
  console.log('');

  console.log('  EMPLOYER CONTRIBUTIONS:');
  for (const [code, amount] of Object.entries(result.employer_totals)) {
    console.log(`    ${code}: R ${(amount as number).toLocaleString()}`);
  }
  console.log('');

  console.log('  PAY LINES:');
  for (const line of emp.lines) {
    const sign = line.amount < 0 ? '' : '+';
    console.log(`    ${line.type.padEnd(22)} ${line.code.padEnd(30)} ${sign}R ${line.amount.toLocaleString()}`);
  }
  console.log('');

  if (emp.totals.pre_tax_deductions) {
    console.log('  PRE-TAX DEDUCTIONS:');
    console.log(`    Retirement:             R ${emp.totals.pre_tax_deductions.retirement_contribution ?? 0}`);
    console.log(`    Medical Aid:            R ${emp.totals.pre_tax_deductions.medical_aid_contribution ?? 0}`);
    console.log(`    Total:                  R ${emp.totals.pre_tax_deductions.total}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
