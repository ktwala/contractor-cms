/**
 * Deterministic sanity check — runs one exact structure through the real ZA engine.
 * Usage: npx ts-node scripts/sanity-check.ts
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

const BASIC = 72000;
const TRAVEL = 14400;
const RETIREMENT = 6000;
const MEDICAL = 15000;
const OTHER_TAXABLE = 12600;
const CTC = BASIC + TRAVEL + RETIREMENT + MEDICAL + OTHER_TAXABLE;

const ctx: PayrollComputeContext = {
  payrun: {
    payrun_id: 'sanity-check',
    payrun_type: 'REGULAR',
    country: 'ZA',
    currency: 'ZAR',
    legal_entity_id: 'sanity',
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
      employee_id: 'sanity-emp',
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
          { code: 'OTHER_TAXABLE', type: 'EARNING', amount: OTHER_TAXABLE, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' as any },
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

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  DETERMINISTIC SANITY CHECK — ZA COMPUTE ENGINE');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('  INPUT:');
  console.log(`    CTC (sum of all):       R ${CTC.toLocaleString()}`);
  console.log(`    Basic Salary:           R ${BASIC.toLocaleString()}`);
  console.log(`    Travel Allowance:       R ${TRAVEL.toLocaleString()}`);
  console.log(`    Other Taxable:          R ${OTHER_TAXABLE.toLocaleString()}`);
  console.log(`    Retirement Fund:        R ${RETIREMENT.toLocaleString()}`);
  console.log(`    Medical Aid:            R ${MEDICAL.toLocaleString()}`);
  console.log(`    Beneficiaries:          2 (1 main + 1 dependant)`);
  console.log('');

  console.log('  ── ENGINE TOTALS ──');
  console.log(`    Gross Earnings:         R ${emp.totals.gross.toLocaleString()}`);
  console.log(`    Taxable Income:         R ${emp.totals.taxable_income.toLocaleString()}`);
  console.log(`    PAYE:                   R ${emp.totals.paye.toLocaleString()}`);
  console.log(`    UIF (statutory):        R ${emp.totals.statutory_deductions.toLocaleString()}`);
  console.log(`    Other Deductions:       R ${emp.totals.other_deductions.toLocaleString()}`);
  console.log(`    Net Pay:                R ${emp.totals.net.toLocaleString()}`);
  console.log('');

  if (emp.totals.pre_tax_deductions) {
    console.log('  ── PRE-TAX DEDUCTIONS ──');
    console.log(`    Retirement:             R ${emp.totals.pre_tax_deductions.retirement_contribution}`);
    console.log(`    Medical Aid:            R ${emp.totals.pre_tax_deductions.medical_aid_contribution}`);
    console.log(`    Total:                  R ${emp.totals.pre_tax_deductions.total}`);
    console.log('');
  }

  console.log('  ── TRACE (calculation steps) ──');
  for (const t of emp.trace) {
    const inputStr = t.inputs ? `  inputs=${JSON.stringify(t.inputs)}` : '';
    const outputStr = t.output !== undefined ? `  output=${t.output}` : '';
    console.log(`    [${t.step}] ${t.description}${inputStr}${outputStr}`);
  }
  console.log('');

  console.log('  ── ALL PAY LINES ──');
  for (const line of emp.lines) {
    const sign = line.type === 'EARNING' ? '+' : '-';
    const taxable = line.is_taxable !== undefined ? (line.is_taxable ? '(taxable)' : '(non-taxable)') : '';
    console.log(`    ${line.type.padEnd(22)} ${line.code.padEnd(30)} ${sign}R ${Math.abs(line.amount).toLocaleString()}  ${taxable}`);
  }
  console.log('');

  console.log('  ── EMPLOYER CONTRIBUTIONS ──');
  for (const [code, amount] of Object.entries(result.employer_totals)) {
    console.log(`    ${code}: R ${(amount as number).toLocaleString()}`);
  }
  console.log('');

  // Manual verification
  console.log('  ── MANUAL VERIFICATION ──');
  const grossExpected = BASIC + TRAVEL + OTHER_TAXABLE;
  const taxableEarnings = BASIC + TRAVEL + OTHER_TAXABLE;
  const maxRetDeduct = Math.min(grossExpected * 0.275, 350000 / 12);
  const deductibleRet = Math.min(RETIREMENT, maxRetDeduct);
  const taxableIncome = taxableEarnings - deductibleRet;
  const annualTaxable = taxableIncome * 12;
  console.log(`    Gross (earnings only):  R ${grossExpected.toLocaleString()}`);
  console.log(`    Taxable earnings:       R ${taxableEarnings.toLocaleString()}`);
  console.log(`    Max deductible ret:     R ${maxRetDeduct.toFixed(2)} (27.5% of gross or R29,166.67/mo cap)`);
  console.log(`    Actual deductible ret:  R ${deductibleRet.toLocaleString()}`);
  console.log(`    Taxable income:         R ${taxableIncome.toLocaleString()} (${taxableEarnings} - ${deductibleRet})`);
  console.log(`    Annual taxable:         R ${annualTaxable.toLocaleString()}`);

  // Bracket lookup
  let annualTax = 0;
  for (const bracket of taxData.brackets) {
    const max = bracket.max ?? Infinity;
    if (annualTaxable >= bracket.min && annualTaxable <= max) {
      annualTax = bracket.base_amount + bracket.rate * (annualTaxable - bracket.min);
      console.log(`    Bracket:                ${(bracket.rate * 100).toFixed(0)}% above R${bracket.min.toLocaleString()}, base R${bracket.base_amount.toLocaleString()}`);
      break;
    }
  }
  const rebateTotal = 17235;
  const annualAfterRebate = Math.max(0, annualTax - rebateTotal);
  const monthlyPaye = annualAfterRebate / 12;
  const mtcCredit = 364 + 364; // 1 main + 1 first dependant
  const finalPaye = Math.max(0, monthlyPaye - mtcCredit);
  console.log(`    Annual tax (gross):     R ${annualTax.toFixed(2)}`);
  console.log(`    Rebate (primary, <65):  R ${rebateTotal.toLocaleString()}`);
  console.log(`    Annual after rebate:    R ${annualAfterRebate.toFixed(2)}`);
  console.log(`    Monthly PAYE (pre-MTC): R ${monthlyPaye.toFixed(2)}`);
  console.log(`    MTC (1 main + 1 dep):   R ${mtcCredit}`);
  console.log(`    Final PAYE:             R ${finalPaye.toFixed(2)}`);

  const uifCalc = Math.min(grossExpected, 17712) * 0.01;
  const netCalc = grossExpected - finalPaye - uifCalc - RETIREMENT - MEDICAL;
  console.log(`    UIF employee:           R ${uifCalc.toFixed(2)}`);
  console.log(`    Net = gross - PAYE - UIF - retirement - medical`);
  console.log(`    Net = ${grossExpected} - ${finalPaye.toFixed(2)} - ${uifCalc.toFixed(2)} - ${RETIREMENT} - ${MEDICAL}`);
  console.log(`    Net:                    R ${netCalc.toFixed(2)}`);
  console.log('');

  // Sanity checks
  console.log('  ── SANITY CHECKS ──');
  console.log(`    Engine gross == manual gross?       ${emp.totals.gross === grossExpected ? 'PASS' : 'FAIL'} (${emp.totals.gross} vs ${grossExpected})`);
  console.log(`    Engine taxable == manual taxable?   ${emp.totals.taxable_income === taxableIncome ? 'PASS' : 'FAIL'} (${emp.totals.taxable_income} vs ${taxableIncome})`);
  console.log(`    Engine PAYE == manual PAYE?         ${Math.abs(emp.totals.paye - finalPaye) < 1 ? 'PASS' : 'FAIL'} (${emp.totals.paye} vs ${finalPaye.toFixed(2)})`);
  console.log(`    Engine net == manual net?           ${Math.abs(emp.totals.net - netCalc) < 1 ? 'PASS' : 'FAIL'} (${emp.totals.net} vs ${netCalc.toFixed(2)})`);
  console.log(`    Taxable income > 0?                 ${emp.totals.taxable_income > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`    PAYE in tens of thousands?          ${emp.totals.paye >= 1000 && emp.totals.paye < 100000 ? 'PASS' : 'FAIL'}`);
  console.log(`    Net in 60k-85k range?               ${emp.totals.net >= 60000 && emp.totals.net <= 85000 ? 'PASS' : 'FAIL'}`);
  console.log(`    Medical deducted exactly once?      ${emp.lines.filter(l => l.code === 'MEDICAL_AID').length === 1 ? 'PASS' : 'FAIL'}`);

  console.log('\n══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
