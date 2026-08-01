/**
 * PR-RBAC-GOV-1 — ROLE_POLICY must match prisma/seed.ts ROLE_PERM_MAP keys;
 * backend and admin-portal policy files must list the same roles.
 *
 * PR-RBAC-GOV-2 — seed must follow documented payroll GOV-3A–3D override split
 * (see docs/RBAC_SPEC.md).
 *
 * Run: npm run check:rbac-role-policy-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:rbac-role-policy-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

/** Keys in ROLE_PERM_MAP (seed). */
function extractRolePermMapKeys(seed: string): string[] {
  const start = seed.indexOf('const ROLE_PERM_MAP');
  if (start < 0) fail('prisma/seed.ts: ROLE_PERM_MAP not found');
  const rest = seed.slice(start);
  const endFn = rest.indexOf('\nasync function main()');
  const block = endFn > 0 ? rest.slice(0, endFn) : rest;
  const keys: string[] = [];
  const re = /^\s{2}([A-Z][A-Z0-9_]*):\s*(?:\[|PERMISSIONS)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    keys.push(m[1]);
  }
  if (keys.length < 10) {
    fail(`prisma/seed.ts: extracted too few ROLE_PERM_MAP keys (got ${keys.length})`);
  }
  return keys;
}

/** Top-level keys inside export const ROLE_POLICY = { ... }. */
function extractRolePolicyKeys(policyTs: string): string[] {
  const marker = 'export const ROLE_POLICY';
  const start = policyTs.indexOf(marker);
  if (start < 0) fail('rbac-role-policy: ROLE_POLICY export not found');
  const open = policyTs.indexOf('{', policyTs.indexOf('=', start));
  if (open < 0) fail('rbac-role-policy: ROLE_POLICY opening brace not found');
  let depth = 0;
  let i = open;
  for (; i < policyTs.length; i++) {
    const c = policyTs[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = policyTs.slice(open + 1, i);
  const keys: string[] = [];
  const re = /^\s{2}([A-Z][A-Z0-9_]*):\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    keys.push(m[1]);
  }
  if (keys.length < 10) {
    fail(`rbac-role-policy: extracted too few ROLE_POLICY keys (got ${keys.length})`);
  }
  return keys;
}

function sortedUnique(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

/** Body of `ROLE_NAME: [ ... ]` in seed (string permissions only). */
function extractArrayRolePermissions(seed: string, roleName: string): string {
  const prefix = `${roleName}: [`;
  const start = seed.indexOf(prefix);
  if (start < 0) fail(`prisma/seed.ts: ${roleName}: [ block not found`);
  let i = start + prefix.length;
  let depth = 1;
  const from = i;
  while (i < seed.length && depth > 0) {
    const c = seed[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
  }
  return seed.slice(from, i - 1);
}

function assertPrRbacGov2OverrideSplit(seed: string): void {
  const O = {
    readiness: 'payrun:readiness_override',
    financial: 'payrun:financial_override',
    bank: 'payrun:bank_override',
    gl: 'payrun:gl_override',
    closed: 'payrun:closed_period_override',
  };

  const tenant = extractArrayRolePermissions(seed, 'TENANT_ADMIN');
  for (const [k, code] of Object.entries(O)) {
    if (tenant.includes(code)) {
      fail(`PR-RBAC-GOV-2: TENANT_ADMIN must not include ${code} (${k} override).`);
    }
  }

  for (const role of ['PAYROLL_MANAGER', 'GLOBAL_PAYROLL_ADMIN'] as const) {
    const b = extractArrayRolePermissions(seed, role);
    for (const code of [O.readiness, O.financial, O.closed]) {
      if (!b.includes(code)) {
        fail(`PR-RBAC-GOV-2: ${role} must include ${code}.`);
      }
    }
    for (const code of [O.bank, O.gl]) {
      if (b.includes(code)) {
        fail(`PR-RBAC-GOV-2: ${role} must not include ${code} (treasury/GL overrides live elsewhere).`);
      }
    }
  }

  const payOp = extractArrayRolePermissions(seed, 'PAYMENT_OPERATOR');
  if (!payOp.includes(O.bank)) {
    fail('PR-RBAC-GOV-2: PAYMENT_OPERATOR must include payrun:bank_override.');
  }
  for (const code of [O.readiness, O.financial, O.gl, O.closed]) {
    if (payOp.includes(code)) {
      fail(`PR-RBAC-GOV-2: PAYMENT_OPERATOR must not include ${code}.`);
    }
  }

  const finRev = extractArrayRolePermissions(seed, 'FINANCE_REVIEWER');
  if (!finRev.includes(O.gl)) {
    fail('PR-RBAC-GOV-2: FINANCE_REVIEWER must include payrun:gl_override.');
  }
  for (const code of [O.readiness, O.financial, O.bank, O.closed]) {
    if (finRev.includes(code)) {
      fail(`PR-RBAC-GOV-2: FINANCE_REVIEWER must not include ${code}.`);
    }
  }

  const analyst = extractArrayRolePermissions(seed, 'RECONCILIATION_ANALYST');
  for (const code of Object.values(O)) {
    if (analyst.includes(code)) {
      fail(`PR-RBAC-GOV-2: RECONCILIATION_ANALYST must not include override ${code} (review without override).`);
    }
  }
}

function main(): void {
  const seedPath = path.join(REPO, 'prisma/seed.ts');
  const backendPath = path.join(REPO, 'src/common/constants/rbac-role-policy.ts');
  const frontendPath = path.join(REPO, 'admin-portal/src/shared/rbacRolePolicy.ts');
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  const mapKeys = sortedUnique(extractRolePermMapKeys(read(seedPath)));
  const backKeys = sortedUnique(extractRolePolicyKeys(read(backendPath)));
  const frontKeys = sortedUnique(extractRolePolicyKeys(read(frontendPath)));

  const setMap = new Set(mapKeys);
  const setBack = new Set(backKeys);
  const setFront = new Set(frontKeys);

  for (const k of mapKeys) {
    if (!setBack.has(k)) {
      fail(`ROLE_POLICY (backend) missing role from prisma/seed ROLE_PERM_MAP: ${k}`);
    }
    if (!setFront.has(k)) {
      fail(`ROLE_POLICY (admin-portal) missing role from prisma/seed ROLE_PERM_MAP: ${k}`);
    }
  }
  for (const k of backKeys) {
    if (!setMap.has(k)) {
      fail(`ROLE_POLICY (backend) has extra role not in prisma/seed ROLE_PERM_MAP: ${k}`);
    }
  }
  for (const k of frontKeys) {
    if (!setMap.has(k)) {
      fail(`ROLE_POLICY (admin-portal) has extra role not in prisma/seed ROLE_PERM_MAP: ${k}`);
    }
  }
  if (backKeys.join(',') !== frontKeys.join(',')) {
    fail(
      'Backend and admin-portal ROLE_POLICY key sets differ. Keep rbac-role-policy.ts and rbacRolePolicy.ts in sync.',
    );
  }

  if (!pkg.includes('check:rbac-role-policy-drift')) {
    fail('package.json must define npm script check:rbac-role-policy-drift.');
  }
  if (!ci.includes('npm run check:rbac-role-policy-drift')) {
    fail('.github/workflows/ci.yml must run npm run check:rbac-role-policy-drift.');
  }

  assertPrRbacGov2OverrideSplit(read(seedPath));

  console.log(
    `[check:rbac-role-policy-drift] OK — ${mapKeys.length} roles: seed ROLE_PERM_MAP ↔ ROLE_POLICY; PR-RBAC-GOV-2 override split verified.`,
  );
}

main();
