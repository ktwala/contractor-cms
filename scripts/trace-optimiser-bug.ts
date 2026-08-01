/**
 * Trace script: proves the evaluator bug by running the SAME scenario
 * through the evaluator's scenarioToPayItems (broken) vs correct items.
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
  periods_per_year: { MONTHLY: 12 },
};

const scenario = {
  basicSalary: 72000,
  travelAllowance: 14400,
  reimbursiveTravelNonTaxable: 0,
  otherAllowanceTaxable: 12600,
  otherAllowanceNonTaxable: 0,
  medicalAidEmployerContribution: 15000,
  retirementContribution: 6000,
};

function buildTaxTables() {
  return {
    effective_from: '2025-03-01',
    brackets: taxData.brackets,
    meta: {
      ...taxData.rebates,
      rebates: taxData.rebates,
      thresholds: taxData.thresholds,
      periods_per_year: taxData.periods_per_year,
    },
  };
}

function buildBaseContext(payItems: any[]): PayrollComputeContext {
  return {
    payrun: {
      payrun_id: 'trace-bug',
      payrun_type: 'REGULAR',
      country: 'ZA',
      currency: 'ZAR',
      legal_entity_id: 'trace',
      period: { start: '2026-03-01', end: '2026-03-31', pay_date: '2026-03-31', period_type: 'MONTHLY' },
    },
    tax_tables: buildTaxTables(),
    employees: [{
      employee_id: 'trace-emp',
      employment: { employment_type: 'PERMANENT', start_date: '2020-01-01' },
      tax_profile: {
        residency_status: 'RESIDENT',
        age: 35,
        meta: { medical_aid_members: 2, medical_scheme: { main_members: 1, dependants: 1 } },
      },
      inputs: {
        base_salary: scenario.basicSalary,
        pay_items: payItems,
      },
    }],
    rules: { ordered: [] },
    rounding_policy: { mode: 'HALF_UP', decimals: 2 },
  };
}

async function main() {
  const pack = new SouthAfricaComputePack();

  // ── BROKEN: what the evaluator currently sends (no BASIC_SALARY pay item) ──
  const brokenPayItems: any[] = [];
  if (scenario.travelAllowance > 0) {
    brokenPayItems.push({ code: 'TRAVEL_ALLOWANCE', type: 'EARNING', amount: scenario.travelAllowance, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' });
  }
  if (scenario.otherAllowanceTaxable > 0) {
    brokenPayItems.push({ code: 'OTHER_ALLOWANCE_TAXABLE', type: 'EARNING', amount: scenario.otherAllowanceTaxable, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' });
  }
  if (scenario.medicalAidEmployerContribution > 0) {
    brokenPayItems.push({ code: 'MEDICAL_AID_CONTRIBUTION', type: 'DEDUCTION', amount: scenario.medicalAidEmployerContribution, is_taxable: false, classification: 'MEDICAL_AID_CONTRIBUTION' });
  }
  if (scenario.retirementContribution > 0) {
    brokenPayItems.push({ code: 'RETIREMENT_FUND', type: 'DEDUCTION', amount: scenario.retirementContribution, is_taxable: false, classification: 'RETIREMENT_CONTRIBUTION' });
  }

  // ── FIXED: with BASIC_SALARY as a pay item ──
  const fixedPayItems: any[] = [
    { code: 'BASIC_SALARY', type: 'EARNING', amount: scenario.basicSalary, is_taxable: true, classification: 'BASIC_SALARY' },
    ...brokenPayItems,
  ];

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  EVALUATOR BUG TRACE');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('  Scenario breakdown:');
  console.log(`    Basic Salary:       R ${scenario.basicSalary.toLocaleString()}`);
  console.log(`    Travel Allowance:   R ${scenario.travelAllowance.toLocaleString()}`);
  console.log(`    Other Taxable:      R ${scenario.otherAllowanceTaxable.toLocaleString()}`);
  console.log(`    Medical Aid:        R ${scenario.medicalAidEmployerContribution.toLocaleString()}`);
  console.log(`    Retirement:         R ${scenario.retirementContribution.toLocaleString()}`);
  console.log('');

  // Run BROKEN path
  console.log('  ── BROKEN PATH (current evaluator — missing BASIC_SALARY) ──');
  console.log(`    Pay items sent: ${brokenPayItems.length}`);
  for (const item of brokenPayItems) {
    console.log(`      ${item.type.padEnd(12)} ${item.code.padEnd(30)} R ${item.amount.toLocaleString()}`);
  }
  const brokenResult = await pack.compute(buildBaseContext(brokenPayItems));
  const brokenEmp = brokenResult.employee_results[0];
  console.log(`    → Gross:            R ${brokenEmp.totals.gross.toLocaleString()}`);
  console.log(`    → Taxable Income:   R ${brokenEmp.totals.taxable_income.toLocaleString()}`);
  console.log(`    → PAYE:             R ${brokenEmp.totals.paye.toLocaleString()}`);
  console.log(`    → Net Pay:          R ${brokenEmp.totals.net.toLocaleString()}`);
  console.log('');

  // Run FIXED path
  console.log('  ── FIXED PATH (with BASIC_SALARY as pay item) ──');
  console.log(`    Pay items sent: ${fixedPayItems.length}`);
  for (const item of fixedPayItems) {
    console.log(`      ${item.type.padEnd(12)} ${item.code.padEnd(30)} R ${item.amount.toLocaleString()}`);
  }
  const fixedResult = await pack.compute(buildBaseContext(fixedPayItems));
  const fixedEmp = fixedResult.employee_results[0];
  console.log(`    → Gross:            R ${fixedEmp.totals.gross.toLocaleString()}`);
  console.log(`    → Taxable Income:   R ${fixedEmp.totals.taxable_income.toLocaleString()}`);
  console.log(`    → PAYE:             R ${fixedEmp.totals.paye.toLocaleString()}`);
  console.log(`    → Net Pay:          R ${fixedEmp.totals.net.toLocaleString()}`);
  console.log('');

  console.log('  ── ROOT CAUSE ──');
  console.log(`    Missing earnings:   R ${(fixedEmp.totals.gross - brokenEmp.totals.gross).toLocaleString()} (= basic salary)`);
  console.log(`    Net pay delta:      R ${(fixedEmp.totals.net - brokenEmp.totals.net).toLocaleString()}`);
  console.log(`    Bug location:       ctc-scenario-evaluator.service.ts → scenarioToPayItems()`);
  console.log(`    Cause:              BASIC_SALARY is never added as a pay item.`);
  console.log(`                        base_salary is set in context but the pack only reads pay_items.`);
  console.log('');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
