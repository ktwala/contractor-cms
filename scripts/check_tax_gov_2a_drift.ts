#!/usr/bin/env tsx
/**
 * PR-TAX-GOV-2A — Drift guards (no DB): TTA alias ban, legacy admin route order, seed vs constants parity.
 *
 * Run: npm run check:tax-gov-2a-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:tax-gov-2a-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function extractTtaCodesFromBackendConstants(source: string): Set<string> {
  const out = new Set<string>();
  const re = /TTA_[A-Z_]+:\s*'(tax_table_authoring_[^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return out;
}

function extractTtaCodesFromSeed(source: string): Set<string> {
  const out = new Set<string>();
  const re = /\{\s*code:\s*'(tax_table_authoring_[^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return out;
}

/**
 * Ban RBAC permission aliases like `can('tta:create')` (must use `P.TTA_*` / tax_table_authoring_*).
 * Telemetry CustomEvent names such as `tta:funnel` are allowed.
 */
function assertNoTtaPermissionAliasesUnderTaxAuthoring(): void {
  const root = path.join(REPO, 'admin-portal/src/features/tax-table-authoring');
  const walk = (dir: string): void => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx'))) {
        const txt = fs.readFileSync(p, 'utf8');
        if (/can\(\s*['"]tta:/.test(txt)) {
          fail(`Banned can('tta:...') RBAC alias in ${path.relative(REPO, p)} — use P.TTA_* / tax_table_authoring_*`);
        }
      }
    }
  };
  walk(root);
}

function assertLegacyStatutoryRouteBeforeParamId(): void {
  const rel = 'src/modules/admin/tax-tables-admin.controller.ts';
  const s = read(rel);
  const statutory = s.search(/^\s*@Get\('statutory-configs\/:country'\)/m);
  const paramId = s.search(/^\s*@Get\(':id'\)/m);
  if (statutory === -1) fail(`${rel}: missing @Get('statutory-configs/:country') decorator line`);
  if (paramId === -1) fail(`${rel}: missing @Get(':id') decorator line`);
  if (statutory > paramId) {
    fail(`${rel}: statutory-configs route must be declared before @Get(':id') (route-order regression)`);
  }
}

function assertLegacyWritesRemainDisabled(): void {
  const rel = 'src/modules/admin/tax-tables-admin.controller.ts';
  const s = read(rel);
  if (!s.includes('TTA_LEGACY_PATH_DISABLED')) {
    fail(`${rel}: expected TTA_LEGACY_PATH_DISABLED markers on deprecated mutation paths`);
  }
}

function main(): void {
  const backendP = read('src/common/constants/permissions.ts');
  const seed = read('prisma/seed.ts');
  const adminPortalP = read('admin-portal/src/constants/permissions.ts');

  const fromBackend = extractTtaCodesFromBackendConstants(backendP);
  const fromSeed = extractTtaCodesFromSeed(seed);
  const fromAdminPortal = extractTtaCodesFromBackendConstants(adminPortalP);

  if (fromBackend.size === 0) fail('No TTA_* permission constants found in src/common/constants/permissions.ts');

  for (const code of fromBackend) {
    if (!fromSeed.has(code)) fail(`prisma/seed.ts PERMISSIONS missing code present in permissions.ts: ${code}`);
    if (!fromAdminPortal.has(code))
      fail(`admin-portal/src/constants/permissions.ts missing code present in backend permissions.ts: ${code}`);
  }
  for (const code of fromSeed) {
    if (code.startsWith('tax_table_authoring_') && !fromBackend.has(code)) {
      fail(`prisma/seed.ts contains TTA permission not in src/common/constants/permissions.ts: ${code}`);
    }
  }

  assertNoTtaPermissionAliasesUnderTaxAuthoring();
  assertLegacyStatutoryRouteBeforeParamId();
  assertLegacyWritesRemainDisabled();

  console.log('[check:tax-gov-2a-drift] OK');
}

main();
