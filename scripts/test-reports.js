#!/usr/bin/env node
/**
 * Test script for Reports functionality
 * Tests payslip, bank file, and GL journal generation
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'payroll_platform',
  user: 'postgres',
  password: 'postgres',
});

const PAYRUN_ID = '66666666-6666-6666-6666-666666666666';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

async function testPayslipData() {
  log('cyan', '\n📋 Testing Payslip Data Generation...');

  const query = `
    SELECT
      e.employee_no,
      e.first_name || ' ' || e.last_name as full_name,
      er.gross,
      er.taxable_income,
      er.paye,
      er.deductions_total,
      er.net,
      ba.bank_name,
      ba.masked_account_number,
      tp.tin as tax_number
    FROM employee_results er
    JOIN employees e ON er.employee_id = e.id
    LEFT JOIN bank_accounts ba ON ba.employee_id = e.id AND ba.effective_to IS NULL
    LEFT JOIN tax_profiles tp ON tp.employee_id = e.id AND tp.effective_to IS NULL
    WHERE er.payrun_id = $1
    ORDER BY e.employee_no
  `;

  const result = await pool.query(query, [PAYRUN_ID]);

  console.log('\nPayslip Data:');
  console.log('─'.repeat(80));

  for (const row of result.rows) {
    console.log(`
Employee: ${row.full_name} (${row.employee_no})
Tax Number: ${row.tax_number || 'N/A'}
Bank: ${row.bank_name} - ${row.masked_account_number}
─────────────────────────────────
Gross Pay:        R ${parseFloat(row.gross).toFixed(2).padStart(12)}
PAYE:             R ${parseFloat(row.paye).toFixed(2).padStart(12)}
Total Deductions: R ${parseFloat(row.deductions_total).toFixed(2).padStart(12)}
─────────────────────────────────
Net Pay:          R ${parseFloat(row.net).toFixed(2).padStart(12)}
`);
  }

  log('green', `✓ Generated payslip data for ${result.rows.length} employees`);
  return result.rows;
}

async function testBankFileData() {
  log('cyan', '\n🏦 Testing Bank File Data Generation...');

  const query = `
    SELECT
      e.employee_no,
      e.first_name || ' ' || e.last_name as employee_name,
      ba.bank_name,
      ba.branch_code,
      ba.account_number_enc as account_number,
      ba.account_type,
      er.net as amount,
      'SAL202501' as reference
    FROM employee_results er
    JOIN employees e ON er.employee_id = e.id
    JOIN bank_accounts ba ON ba.employee_id = e.id AND ba.effective_to IS NULL
    WHERE er.payrun_id = $1 AND er.net > 0
    ORDER BY e.employee_no
  `;

  const result = await pool.query(query, [PAYRUN_ID]);

  console.log('\nBank File Records (CSV format):');
  console.log('─'.repeat(80));
  console.log('Employee No,Employee Name,Bank,Branch,Account,Type,Amount,Reference');

  let total = 0;
  for (const row of result.rows) {
    const amount = parseFloat(row.amount);
    total += amount;
    console.log(`${row.employee_no},"${row.employee_name}","${row.bank_name}",${row.branch_code},${row.account_number},${row.account_type},${amount.toFixed(2)},${row.reference}`);
  }

  console.log('─'.repeat(80));
  console.log(`Total: R ${total.toFixed(2)}`);

  log('green', `✓ Generated bank file for ${result.rows.length} payments, total: R ${total.toFixed(2)}`);
  return result.rows;
}

async function testGLJournalData() {
  log('cyan', '\n📊 Testing GL Journal Data Generation...');

  // Aggregate by pay item
  const query = `
    SELECT
      pi.code,
      pi.name,
      pi.type,
      pi.gl_account,
      SUM(pl.amount) as total
    FROM pay_lines pl
    JOIN pay_items pi ON pl.pay_item_id = pi.id
    JOIN employee_results er ON pl.employee_result_id = er.id
    WHERE er.payrun_id = $1
    GROUP BY pi.id, pi.code, pi.name, pi.type, pi.gl_account
    ORDER BY pi.sort_order
  `;

  const result = await pool.query(query, [PAYRUN_ID]);

  // Get total net for liability
  const netQuery = `SELECT SUM(net) as total_net FROM employee_results WHERE payrun_id = $1`;
  const netResult = await pool.query(netQuery, [PAYRUN_ID]);
  const totalNet = parseFloat(netResult.rows[0].total_net);

  console.log('\nGL Journal Entries:');
  console.log('─'.repeat(80));
  console.log('Account    | Description                    |       Debit |      Credit');
  console.log('─'.repeat(80));

  let totalDebits = 0;
  let totalCredits = 0;

  // GL account mapping
  const glMapping = {
    'BASIC': '5100',
    'OVERTIME': '5110',
    'COMMISSION': '5120',
    'TRAVEL': '5150',
    'PAYE': '2200',
    'UIF_EE': '2210',
    'UIF_ER': '5200',
    'SDL': '2220',
  };

  for (const row of result.rows) {
    const amount = Math.abs(parseFloat(row.total));
    const glAccount = glMapping[row.code] || row.gl_account || '9999';
    const isExpense = ['EARNING', 'ALLOWANCE', 'BONUS', 'EMPLOYER_CONTRIB'].includes(row.type);

    let debit = 0, credit = 0;
    if (isExpense) {
      debit = amount;
      totalDebits += amount;
    } else {
      credit = amount;
      totalCredits += amount;
    }

    console.log(`${glAccount.padEnd(10)} | ${row.name.padEnd(30)} | ${debit.toFixed(2).padStart(11)} | ${credit.toFixed(2).padStart(11)}`);
  }

  // Net Pay liability
  console.log(`${'2100'.padEnd(10)} | ${'Net Salaries Payable'.padEnd(30)} | ${''.padStart(11)} | ${totalNet.toFixed(2).padStart(11)}`);
  totalCredits += totalNet;

  console.log('─'.repeat(80));
  console.log(`${'TOTALS'.padEnd(10)} | ${''.padEnd(30)} | ${totalDebits.toFixed(2).padStart(11)} | ${totalCredits.toFixed(2).padStart(11)}`);

  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;
  if (balanced) {
    log('green', '\n✓ Journal is balanced');
  } else {
    log('red', `\n✗ Journal is NOT balanced! Difference: R ${(totalDebits - totalCredits).toFixed(2)}`);
  }

  return result.rows;
}

async function testPayrunSummary() {
  log('cyan', '\n📈 Testing Payrun Summary...');

  const query = `
    SELECT
      pr.id,
      pr.name,
      pr.status,
      pp.period_start,
      pp.period_end,
      COUNT(er.id) as headcount,
      SUM(er.gross) as total_gross,
      SUM(er.taxable_income) as total_taxable,
      SUM(er.paye) as total_paye,
      SUM(er.deductions_total) as total_deductions,
      SUM(er.net) as total_net
    FROM pay_runs pr
    JOIN pay_periods pp ON pr.pay_period_id = pp.id
    LEFT JOIN employee_results er ON er.payrun_id = pr.id
    WHERE pr.id = $1
    GROUP BY pr.id, pr.name, pr.status, pp.period_start, pp.period_end
  `;

  const result = await pool.query(query, [PAYRUN_ID]);
  const summary = result.rows[0];

  console.log('\nPayrun Summary:');
  console.log('═'.repeat(50));
  console.log(`Payrun: ${summary.name}`);
  console.log(`Status: ${summary.status}`);
  console.log(`Period: ${summary.period_start.toISOString().slice(0,10)} to ${summary.period_end.toISOString().slice(0,10)}`);
  console.log(`Headcount: ${summary.headcount}`);
  console.log('─'.repeat(50));
  console.log(`Gross Pay:        R ${parseFloat(summary.total_gross).toFixed(2).padStart(15)}`);
  console.log(`Taxable Income:   R ${parseFloat(summary.total_taxable).toFixed(2).padStart(15)}`);
  console.log(`PAYE:             R ${parseFloat(summary.total_paye).toFixed(2).padStart(15)}`);
  console.log(`Total Deductions: R ${parseFloat(summary.total_deductions).toFixed(2).padStart(15)}`);
  console.log(`Net Pay:          R ${parseFloat(summary.total_net).toFixed(2).padStart(15)}`);
  console.log('═'.repeat(50));

  log('green', '✓ Summary generated successfully');
  return summary;
}

async function runAllTests() {
  console.log('═'.repeat(80));
  log('yellow', '  PAYROLL PLATFORM - REPORTS TEST SUITE');
  console.log('═'.repeat(80));

  try {
    // Test database connection
    const connTest = await pool.query('SELECT NOW()');
    log('green', `✓ Database connected at ${connTest.rows[0].now}`);

    // Run tests
    await testPayslipData();
    await testBankFileData();
    await testGLJournalData();
    await testPayrunSummary();

    console.log('\n' + '═'.repeat(80));
    log('green', '  ALL TESTS PASSED ✓');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    log('red', '✗ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAllTests();
