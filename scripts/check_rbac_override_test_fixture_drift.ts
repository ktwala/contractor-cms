/**
 * PR-RBAC-GOV-3 — No Playwright/unit test may pair TENANT_ADMIN-only fixtures with payrun
 * GOV override permissions (readiness / financial / bank / GL / closed-period).
 *
 * Override coverage must use PAYROLL_MANAGER, PAYMENT_OPERATOR, FINANCE_REVIEWER, or
 * GLOBAL_PAYROLL_ADMIN (or explicit multi-role assignments), not TENANT_ADMIN alone.
 *
 * Run: npm run check:rbac-override-test-fixture-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

const OVERRIDE_PERM_RE =
  /['"]payrun:(readiness|financial|bank|gl|closed_period)_override['"]/g;

function fail(msg: string): never {
  console.error(`[check:rbac-override-test-fixture-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function stripLineComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      if (idx < 0) return line;
      return line.slice(0, idx);
    })
    .join('\n');
}

/** Closing `)` matching `(` at openParenIdx (handles strings). */
function skipToClosingParenOfCall(s: string, openParenIdx: number): number {
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = openParenIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
}

/** Body inside `{` … `}` starting at openBraceIdx. */
function extractBalancedBraces(s: string, openBraceIdx: number): string {
  let depth = 0;
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = openBraceIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(openBraceIdx + 1, i);
    }
  }
  return '';
}

function findArrowCallbackBodyStart(s: string, from: number): number {
  let i = from;
  while (i < s.length && /\s/.test(s[i]!)) i++;
  if (s.slice(i, i + 5) === 'async') {
    i += 5;
    while (i < s.length && /\s/.test(s[i]!)) i++;
  }
  if (s[i] !== '(') return -1;
  const afterFnParams = skipToClosingParenOfCall(s, i);
  let j = afterFnParams;
  while (j < s.length && /\s/.test(s[j]!)) j++;
  if (s[j] !== '=' || s[j + 1] !== '>') return -1;
  j += 2;
  while (j < s.length && /\s/.test(s[j]!)) j++;
  if (s[j] !== '{') return -1;
  return j;
}

function* eachTestCallbackBodies(source: string): Generator<string> {
  const re = /\b(?:test|it)(?:\.\w+)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const afterCall = skipToClosingParenOfCall(source, openParen);
    const bodyStart = findArrowCallbackBodyStart(source, afterCall);
    if (bodyStart < 0) continue;
    yield extractBalancedBraces(source, bodyStart);
  }
}

function rolesArrayIsTenantAdminOnly(inner: string): boolean {
  const parts = inner.split(',').map((p) => p.replace(/\s+/g, ''));
  const nonEmpty = parts.filter(Boolean);
  if (nonEmpty.length !== 1) return false;
  const x = nonEmpty[0]!;
  return x === `'TENANT_ADMIN'` || x === `"TENANT_ADMIN"` || x === '`TENANT_ADMIN`';
}

function bodyUsesTenantAdminOnlyRoles(body: string): boolean {
  const re = /roles:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (rolesArrayIsTenantAdminOnly(m[1] ?? '')) return true;
  }
  return false;
}

function bodyUsesLocalStorageTenantAdmin(body: string): boolean {
  return /localStorage\.setItem\(\s*['"]role['"]\s*,\s*['"]TENANT_ADMIN['"]\s*\)/.test(body);
}

function bodyUsesSeedLocalSessionTenantAdmin(body: string): boolean {
  return /seedLocalSession\(\s*[^,]+\s*,\s*['"]TENANT_ADMIN['"]\s*,/.test(body);
}

function bodyLiteralHasOverridePerm(body: string): boolean {
  OVERRIDE_PERM_RE.lastIndex = 0;
  return OVERRIDE_PERM_RE.test(body);
}

function bodyViolatesGov3(body: string): boolean {
  if (!bodyLiteralHasOverridePerm(body)) return false;
  const tenantOnly =
    bodyUsesTenantAdminOnlyRoles(body) ||
    bodyUsesLocalStorageTenantAdmin(body) ||
    bodyUsesSeedLocalSessionTenantAdmin(body);
  return tenantOnly;
}

function collectSpecFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      collectSpecFiles(p, out);
    } else if (ent.isFile() && ent.name.endsWith('.spec.ts')) {
      out.push(p);
    }
  }
}

function main(): void {
  const roots = [
    path.join(REPO, 'test'),
    path.join(REPO, 'src'),
    path.join(REPO, 'admin-portal/src'),
  ];
  const files: string[] = [];
  for (const r of roots) collectSpecFiles(r, files);

  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!pkg.includes('check:rbac-override-test-fixture-drift')) {
    fail('package.json must define npm script check:rbac-override-test-fixture-drift.');
  }
  if (!ci.includes('npm run check:rbac-override-test-fixture-drift')) {
    fail('.github/workflows/ci.yml must run npm run check:rbac-override-test-fixture-drift.');
  }

  for (const file of files.sort()) {
    const raw = read(file);
    const cleaned = stripLineComments(raw);
    let i = 0;
    for (const body of eachTestCallbackBodies(cleaned)) {
      i++;
      if (bodyViolatesGov3(body)) {
        fail(
          `${path.relative(REPO, file)}: test block #${i} pairs TENANT_ADMIN-only session with payrun *_override permission literals. ` +
            `Use PAYROLL_MANAGER / PAYMENT_OPERATOR / FINANCE_REVIEWER / GLOBAL_PAYROLL_ADMIN for override tests (PR-RBAC-GOV-3).`,
        );
      }
    }
  }

  console.log(
    `[check:rbac-override-test-fixture-drift] OK — scanned ${files.length} *.spec.ts files; no TENANT_ADMIN-only override fixtures.`,
  );
}

main();
