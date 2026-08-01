/**
 * PR-PAYROLL-CONTAINER-1 … PR-PAYROLL-CONTAINER-4-LOCK — payroll tax-year shell drift gate (CI).
 * Enforces docs/PAYROLL_CONTAINER_GOVERNANCE.md (doctrine + PR-PAYROLL-CONTAINER-4-LOCK section).
 * Run: npm run check:payroll-container-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payroll-container-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function collectSourceFiles(rootDir: string, acc: string[]): void {
  if (!fs.existsSync(rootDir)) return;
  for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'build') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx|ts|jsx|js|vue)$/.test(ent.name)) {
      acc.push(full);
    }
  }
}

function assertNoMisleadingPayrollReplacesPayGroupCopy(): void {
  const roots = [
    path.join(REPO, 'admin-portal/src'),
    path.join(REPO, 'employee-portal/src'),
  ];
  const files: string[] = [];
  for (const r of roots) collectSourceFiles(r, files);

  const patterns: RegExp[] = [
    /\bpayroll\b[^.\n]{0,120}\breplaces?\b[^.\n]{0,120}\bpay[\s-]*group\b/i,
    /\breplaces?\b[^.\n]{0,120}\bpay[\s-]*group\b[^.\n]{0,120}\bpayroll\b/i,
  ];

  for (const f of files) {
    const text = read(f);
    for (const re of patterns) {
      if (re.test(text)) {
        fail(
          `UI/source copy must not imply Payroll replaces PayGroup (matched ${String(re)} in ${path.relative(REPO, f)}).`,
        );
      }
    }
  }
}

function main(): void {
  const schema = read(path.join(REPO, 'prisma/schema.prisma'));
  const doc = read(path.join(REPO, 'docs/PAYROLL_CONTAINER_GOVERNANCE.md'));
  const controller = read(path.join(REPO, 'src/modules/payroll-containers/payroll-containers.controller.ts'));
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  const backfillScript = path.join(REPO, 'scripts/backfill_pay_period_payroll_ids.ts');
  const verifyScript = path.join(REPO, 'scripts/verify_payroll_container_period_linkage.ts');
  if (!fs.existsSync(backfillScript)) {
    fail('PR-PAYROLL-CONTAINER-2 requires scripts/backfill_pay_period_payroll_ids.ts.');
  }
  if (!fs.existsSync(verifyScript)) {
    fail('PR-PAYROLL-CONTAINER-2 requires scripts/verify_payroll_container_period_linkage.ts.');
  }

  if (!schema.includes('model Payroll')) {
    fail('prisma/schema.prisma must define model Payroll.');
  }
  if (!schema.includes('payroll_id') || !schema.includes('payrollId')) {
    fail('PayPeriod must declare payroll_id / payrollId for optional Payroll link.');
  }
  if (!schema.includes('pay_group_id') || !schema.includes('payGroupId')) {
    fail('Payroll model must reference pay_group_id / payGroupId (PayGroup remains workforce scope).');
  }
  if (!schema.includes('PayrollTaxYearStatus')) {
    fail('PayrollTaxYearStatus enum must exist.');
  }
  if (!schema.includes('model PayGroup')) {
    fail('PayGroup model must remain (workforce scope).');
  }
  if (!schema.includes('payrolls_pay_group_tax_year_window_key')) {
    fail('Payroll must have @@unique([payGroupId, taxYearStart, taxYearEnd]) — map payrolls_pay_group_tax_year_window_key.');
  }

  const doctrineMarkers = [
    'PayGroup',
    'Who is eligible',
    'Payroll',
    'tax-year governance shell',
    'PayPeriod',
    'PayRun',
    'execution',
    'check:payroll-container-drift',
  ];
  for (const m of doctrineMarkers) {
    if (!doc.includes(m)) {
      fail(`docs/PAYROLL_CONTAINER_GOVERNANCE.md must include doctrine marker: "${m}".`);
    }
  }

  const container2Markers = [
    'PR-PAYROLL-CONTAINER-2',
    'backfill_pay_period_payroll_ids',
    'verify_payroll_container_period_linkage',
    'payrolls_pay_group_tax_year_window_key',
    'start_date',
    'npm run verify:payroll-container-period-linkage',
    'npm run backfill:pay-period-payroll-ids',
  ];
  for (const m of container2Markers) {
    if (!doc.includes(m)) {
      fail(`docs/PAYROLL_CONTAINER_GOVERNANCE.md must document CONTAINER-2 / backfill marker: "${m}".`);
    }
  }

  const container4Markers = [
    'PR-PAYROLL-CONTAINER-4',
    'payroll:containers:close',
    'payroll:containers:archive',
    'lifecycle-eligibility',
    'PAYROLL_CONTAINER_CLOSED',
    'PAYROLL_CONTAINER_ARCHIVED',
    'payroll-container-lifecycle.policy.spec.ts',
    'no hard delete',
  ];
  for (const m of container4Markers) {
    if (!doc.includes(m)) {
      fail(`docs/PAYROLL_CONTAINER_GOVERNANCE.md must document CONTAINER-4 marker: "${m}".`);
    }
  }

  const lockSectionMarkers = [
    'PR-PAYROLL-CONTAINER-4-LOCK',
    'Container lifecycle baseline locked',
    'Required checks',
    'check:payroll-container-drift',
    'payroll-container-lifecycle.policy.spec.ts',
    'Forbidden regressions',
    'Hard delete',
    'Archive with closed periods',
    'Archive with paid / posted / finalized activity',
    'Close with in-flight payruns',
    'UI close/archive without lifecycle preview',
    'Close/archive without audit',
    'Ownership rule',
    'Schema, service, policy, UI, permissions, audit, docs, tests, and drift',
    'must change together',
  ];
  for (const m of lockSectionMarkers) {
    if (!doc.includes(m)) {
      fail(`docs/PAYROLL_CONTAINER_GOVERNANCE.md must include PR-PAYROLL-CONTAINER-4-LOCK section marker: "${m}".`);
    }
  }

  const policySpec = path.join(
    REPO,
    'src/modules/payroll-containers/__tests__/payroll-container-lifecycle.policy.spec.ts',
  );
  if (!fs.existsSync(policySpec)) {
    fail('PR-PAYROLL-CONTAINER-4-LOCK requires src/modules/payroll-containers/__tests__/payroll-container-lifecycle.policy.spec.ts.');
  }

  if (doc.toLowerCase().includes('replace paygroup') || doc.toLowerCase().includes('replaces pay group')) {
    fail('Governance doc must not claim Payroll replaces PayGroup.');
  }

  assertNoMisleadingPayrollReplacesPayGroupCopy();

  const forbiddenMutators = ['@Put(', '@Patch(', '@Delete('];
  for (const verb of forbiddenMutators) {
    if (controller.includes(verb)) {
      fail(`payroll-containers.controller.ts forbids ${verb} (no hard delete / ad-hoc mutation).`);
    }
  }

  const postDecorators = [...controller.matchAll(/@Post\s*\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, ' ').trim());
  const allowedPosts = new Set(["@Post(':id/close')", "@Post(':id/archive')"]);
  for (const p of postDecorators) {
    if (!allowedPosts.has(p)) {
      fail(`Unexpected POST in payroll-containers.controller.ts: ${p} (allowed: close + archive only).`);
    }
  }
  if (postDecorators.length !== 2) {
    fail(`payroll-containers.controller.ts must declare exactly two POST routes (close + archive); found ${postDecorators.length}.`);
  }
  if (postDecorators.filter((x) => x === "@Post(':id/close')").length !== 1) {
    fail('payroll-containers.controller.ts must declare exactly one @Post(\':id/close\').');
  }
  if (postDecorators.filter((x) => x === "@Post(':id/archive')").length !== 1) {
    fail('payroll-containers.controller.ts must declare exactly one @Post(\':id/archive\').');
  }

  if (!controller.includes("@Permissions('payroll:containers:close')")) {
    fail('Close route must require payroll:containers:close.');
  }
  if (!controller.includes("@Permissions('payroll:containers:archive')")) {
    fail('Archive route must require payroll:containers:archive.');
  }
  if (!controller.includes(":id/lifecycle-eligibility")) {
    fail('payroll-containers.controller.ts must expose GET :id/lifecycle-eligibility.');
  }

  if (!controller.includes("@Get()") || !controller.includes("@Get(':id')")) {
    fail('payroll-containers.controller.ts must expose GET list and GET by id.');
  }

  if (!pkg.includes('check:payroll-container-drift')) {
    fail('package.json must define npm script check:payroll-container-drift.');
  }
  if (!pkg.includes('verify:payroll-container-period-linkage')) {
    fail('package.json must define npm script verify:payroll-container-period-linkage.');
  }
  if (!pkg.includes('backfill:pay-period-payroll-ids')) {
    fail('package.json must define npm script backfill:pay-period-payroll-ids.');
  }
  if (!ci.includes('check:payroll-container-drift')) {
    fail('.github/workflows/ci.yml must run check:payroll-container-drift.');
  }
  if (!ci.includes('verify:payroll-container-period-linkage')) {
    fail('.github/workflows/ci.yml must run verify:payroll-container-period-linkage after migrations.');
  }
  if (!ci.includes('db:migrate:prod')) {
    fail('.github/workflows/ci.yml must run db:migrate:prod before payroll linkage verify.');
  }

  console.log('[check:payroll-container-drift] OK');
}

main();
