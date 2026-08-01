/**
 * Test script for Formula Evaluation Service
 *
 * Run with: node scripts/test-formulas.js
 */

// Simulate the FormulaEvaluationService logic
class FormulaEvaluator {
  /**
   * Evaluate a formula expression with context variables
   */
  evaluateFormula(formula, context) {
    if (!formula) return 0;

    let expression = formula.trim();

    // Replace built-in functions
    expression = this.replaceFunctions(expression, context);

    // Replace variable names with values
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        expression = expression.replace(
          new RegExp(`\\b${key}\\b`, 'g'),
          value.toString()
        );
      }
    }

    // Validate expression (only allow safe characters)
    if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
      throw new Error(`Invalid formula expression: ${formula}`);
    }

    // Safe evaluation
    const result = Function(`"use strict"; return (${expression})`)();
    return Math.round(result * 100) / 100;
  }

  /**
   * Replace built-in functions
   */
  replaceFunctions(expression, context) {
    let result = expression;

    // MIN(a, b)
    result = result.replace(
      /MIN\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (_, a, b) => {
        const valA = this.resolveValue(a, context);
        const valB = this.resolveValue(b, context);
        return Math.min(valA, valB).toString();
      }
    );

    // MAX(a, b)
    result = result.replace(
      /MAX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (_, a, b) => {
        const valA = this.resolveValue(a, context);
        const valB = this.resolveValue(b, context);
        return Math.max(valA, valB).toString();
      }
    );

    // ROUND(a, decimals)
    result = result.replace(
      /ROUND\s*\(\s*([^,]+)\s*,\s*(\d+)\s*\)/gi,
      (_, a, decimals) => {
        const val = this.resolveValue(a, context);
        const d = parseInt(decimals, 10);
        const factor = Math.pow(10, d);
        return (Math.round(val * factor) / factor).toString();
      }
    );

    // ANNUAL(a)
    result = result.replace(/ANNUAL\s*\(\s*([^)]+)\s*\)/gi, (_, a) => {
      const val = this.resolveValue(a, context);
      return (val * 12).toString();
    });

    // MONTHLY(a)
    result = result.replace(/MONTHLY\s*\(\s*([^)]+)\s*\)/gi, (_, a) => {
      const val = this.resolveValue(a, context);
      return (val / 12).toString();
    });

    return result;
  }

  resolveValue(expr, context) {
    const trimmed = expr.trim();
    if (context[trimmed] !== undefined) {
      return context[trimmed];
    }

    let resolved = trimmed;
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        resolved = resolved.replace(
          new RegExp(`\\b${key}\\b`, 'g'),
          value.toString()
        );
      }
    }

    try {
      return Function(`"use strict"; return (${resolved})`)();
    } catch {
      return parseFloat(trimmed) || 0;
    }
  }

  /**
   * Topologically sort items by dependencies
   */
  topologicalSort(items) {
    const itemMap = new Map(items.map(item => [item.code, item]));
    const visited = new Set();
    const result = [];

    const visit = (code) => {
      if (visited.has(code)) return;
      visited.add(code);

      const item = itemMap.get(code);
      if (!item) return;

      for (const dep of item.deps || []) {
        if (itemMap.has(dep)) {
          visit(dep);
        }
      }

      result.push(item);
    };

    for (const item of items) {
      visit(item.code);
    }

    return result;
  }
}

// Test cases
function runTests() {
  const evaluator = new FormulaEvaluator();
  const tests = [];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          Formula Evaluation Service Test Suite               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Test 1: Basic percentage calculation
  const ctx1 = { BASIC: 25000 };
  const result1 = evaluator.evaluateFormula('BASIC * 0.01', ctx1);
  tests.push({
    name: 'UIF Employee (1% of BASIC)',
    formula: 'BASIC * 0.01',
    context: ctx1,
    expected: 250,
    actual: result1,
    passed: result1 === 250
  });

  // Test 2: MIN function with cap
  const ctx2 = { BASIC: 25000 };
  const result2 = evaluator.evaluateFormula('MIN(BASIC * 0.01, 177.12)', ctx2);
  tests.push({
    name: 'UIF with cap (R177.12 max)',
    formula: 'MIN(BASIC * 0.01, 177.12)',
    context: ctx2,
    expected: 177.12,
    actual: result2,
    passed: result2 === 177.12
  });

  // Test 3: MIN function without hitting cap
  const ctx3 = { BASIC: 10000 };
  const result3 = evaluator.evaluateFormula('MIN(BASIC * 0.01, 177.12)', ctx3);
  tests.push({
    name: 'UIF without hitting cap',
    formula: 'MIN(BASIC * 0.01, 177.12)',
    context: ctx3,
    expected: 100,
    actual: result3,
    passed: result3 === 100
  });

  // Test 4: Pension calculation (7.5%)
  const ctx4 = { GROSS: 30000 };
  const result4 = evaluator.evaluateFormula('GROSS * 0.075', ctx4);
  tests.push({
    name: 'Pension (7.5% of GROSS)',
    formula: 'GROSS * 0.075',
    context: ctx4,
    expected: 2250,
    actual: result4,
    passed: result4 === 2250
  });

  // Test 5: MAX function
  const ctx5 = { BASIC: 5000 };
  const result5 = evaluator.evaluateFormula('MAX(BASIC * 0.02, 150)', ctx5);
  tests.push({
    name: 'MAX function (minimum floor)',
    formula: 'MAX(BASIC * 0.02, 150)',
    context: ctx5,
    expected: 150,
    actual: result5,
    passed: result5 === 150
  });

  // Test 6: ANNUAL function
  const ctx6 = { BASIC: 25000 };
  const result6 = evaluator.evaluateFormula('ANNUAL(BASIC)', ctx6);
  tests.push({
    name: 'ANNUAL function (monthly to annual)',
    formula: 'ANNUAL(BASIC)',
    context: ctx6,
    expected: 300000,
    actual: result6,
    passed: result6 === 300000
  });

  // Test 7: MONTHLY function
  const ctx7 = { ANNUAL_BONUS: 12000 };
  const result7 = evaluator.evaluateFormula('MONTHLY(ANNUAL_BONUS)', ctx7);
  tests.push({
    name: 'MONTHLY function (annual to monthly)',
    formula: 'MONTHLY(ANNUAL_BONUS)',
    context: ctx7,
    expected: 1000,
    actual: result7,
    passed: result7 === 1000
  });

  // Test 8: Complex formula with multiple variables
  const ctx8 = { BASIC: 20000, OVERTIME: 3000, ALLOWANCE: 2000 };
  const result8 = evaluator.evaluateFormula('(BASIC + OVERTIME + ALLOWANCE) * 0.01', ctx8);
  tests.push({
    name: 'Complex formula (sum * percentage)',
    formula: '(BASIC + OVERTIME + ALLOWANCE) * 0.01',
    context: ctx8,
    expected: 250,
    actual: result8,
    passed: result8 === 250
  });

  // Test 9: ROUND function
  const ctx9 = { BASIC: 25333.33 };
  const result9 = evaluator.evaluateFormula('ROUND(BASIC * 0.01, 2)', ctx9);
  tests.push({
    name: 'ROUND function (2 decimals)',
    formula: 'ROUND(BASIC * 0.01, 2)',
    context: ctx9,
    expected: 253.33,
    actual: result9,
    passed: result9 === 253.33
  });

  // Test 10: Dependency-based calculation
  const ctx10 = { BASIC: 20000, PENSION_EE: 1500 }; // PENSION_EE already calculated
  const result10 = evaluator.evaluateFormula('BASIC - PENSION_EE', ctx10);
  tests.push({
    name: 'Dependency-based (BASIC - PENSION)',
    formula: 'BASIC - PENSION_EE',
    context: ctx10,
    expected: 18500,
    actual: result10,
    passed: result10 === 18500
  });

  // Print results
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const status = test.passed ? '✓' : '✗';
    const color = test.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${color}${status}${reset} ${test.name}`);
    console.log(`  Formula: ${test.formula}`);
    console.log(`  Context: ${JSON.stringify(test.context)}`);
    console.log(`  Expected: ${test.expected}, Actual: ${test.actual}`);
    console.log('');

    if (test.passed) passed++;
    else failed++;
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Test topological sort
  console.log('\n--- Topological Sort Test ---\n');

  const payItems = [
    { code: 'UIF_EE', formula: 'MIN(BASIC * 0.01, 177.12)', deps: ['BASIC'] },
    { code: 'PENSION_EE', formula: 'GROSS * 0.075', deps: ['GROSS'] },
    { code: 'TAXABLE', formula: 'GROSS - PENSION_EE', deps: ['GROSS', 'PENSION_EE'] },
    { code: 'GROSS', formula: 'BASIC + OVERTIME', deps: ['BASIC', 'OVERTIME'] },
  ];

  const sorted = evaluator.topologicalSort(payItems);
  console.log('Input order:', payItems.map(i => i.code).join(' → '));
  console.log('Sorted order:', sorted.map(i => i.code).join(' → '));
  console.log('Expected: GROSS → PENSION_EE → TAXABLE → UIF_EE (or similar valid order)');

  // Full employee payrun simulation
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('         Full PayRun Simulation for ZA Employee');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const employee = {
    name: 'John Doe',
    basic: 35000,
    overtime: 2500,
  };

  // Define formula-based pay items
  const formulaItems = [
    { code: 'UIF_EE', name: 'UIF Employee', type: 'DEDUCTION', formula: 'MIN(BASIC * 0.01, 177.12)', deps: ['BASIC'] },
    { code: 'PENSION_EE', name: 'Pension Employee', type: 'DEDUCTION', formula: 'GROSS * 0.075', deps: ['GROSS'] },
  ];

  // Build context
  const empContext = {
    BASIC: employee.basic,
    OVERTIME: employee.overtime,
    GROSS: employee.basic + employee.overtime,
  };

  console.log(`Employee: ${employee.name}`);
  console.log(`Basic Salary: R${employee.basic.toLocaleString()}`);
  console.log(`Overtime: R${employee.overtime.toLocaleString()}`);
  console.log(`Gross Pay: R${empContext.GROSS.toLocaleString()}`);
  console.log('');

  // Evaluate each formula item
  const sortedFormulas = evaluator.topologicalSort(formulaItems);
  const results = {};

  for (const item of sortedFormulas) {
    const amount = evaluator.evaluateFormula(item.formula, { ...empContext, ...results });
    results[item.code] = amount;
    console.log(`${item.name}: R${amount.toFixed(2)}`);
    console.log(`  Formula: ${item.formula}`);
    console.log(`  Trace: ${item.formula} => R${amount.toFixed(2)}`);
    console.log('');
  }

  // Summary
  const totalDeductions = Object.values(results).reduce((sum, val) => sum + val, 0);
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total Formula-Based Deductions: R${totalDeductions.toFixed(2)}`);
  console.log(`Net After Deductions: R${(empContext.GROSS - totalDeductions).toFixed(2)}`);
  console.log('(Note: PAYE still calculated by country pack)');
}

runTests();
