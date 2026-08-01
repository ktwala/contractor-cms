/**
 * Payroll import contract drift checks (CI).
 * Run: npm run check:payroll-import-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payroll-import-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function walkFiles(root: string, exclDirs: Set<string>, exts: Set<string>): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (exclDirs.has(ent.name)) continue;
        walk(full);
      } else {
        const ext = path.extname(ent.name);
        if (exts.has(ext)) out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

function checkNoTaxprofilesResurrection(): void {
  const allow = new Set<string>([
    path.join(REPO, 'src/modules/data-imports/payroll-supplemental/payroll-supplemental-legacy-sheet-names.ts'),
  ]);
  const roots = [
    path.join(REPO, 'src'),
    path.join(REPO, 'admin-portal/src'),
    path.join(REPO, 'scripts'),
  ];
  /** Lowercase workbook tab only; do not match camelCase `taxProfiles` (Prisma / TS fields). */
  const needle = /\btaxprofiles\b/;
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const files = walkFiles(root, new Set(['node_modules', 'dist', 'coverage', '.git']), new Set(['.ts', '.tsx', '.md']));
    for (const f of files) {
      if (f.includes(`${path.sep}prisma${path.sep}migrations${path.sep}`)) continue;
      if (f.endsWith(`${path.sep}check_payroll_import_drift.ts`)) continue;
      if (allow.has(f)) continue;
      const t = read(f);
      if (needle.test(t)) {
        fail(`Disallowed "taxprofiles" reference in ${path.relative(REPO, f)} (keep only in legacy allowlist file or prisma migrations).`);
      }
    }
  }
}

function extractSupplementalTemplateBody(fileText: string): string {
  const start = fileText.indexOf('async generateSupplementalTemplate()');
  if (start < 0) fail('Could not find generateSupplementalTemplate in template-generation.service.ts');
  const end = fileText.indexOf('/** Tenant-facing opening balances workbook', start);
  if (end < 0) fail('Could not find end of supplemental template method');
  return fileText.slice(start, end);
}

function extractOpeningBalancesTemplateBody(fileText: string): string {
  const start = fileText.indexOf('async generateOpeningBalancesTemplate()');
  if (start < 0) fail('Could not find generateOpeningBalancesTemplate in template-generation.service.ts');
  const tail = fileText.slice(start);
  const m = tail.match(/return Buffer\.from\(buffer\);\n  \}/);
  if (!m || m.index === undefined) fail('Could not find end of opening balances template method');
  return tail.slice(0, m.index + m[0].length);
}

function addWorksheetNames(body: string): string[] {
  const names: string[] = [];
  const re = /\.addWorksheet\(\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function checkTemplateParserParity(): void {
  const tmplPath = path.join(REPO, 'src/modules/payroll/template-generation.service.ts');
  const tmpl = read(tmplPath);
  const suppBody = extractSupplementalTemplateBody(tmpl);
  const obBody = extractOpeningBalancesTemplateBody(tmpl);

  const suppSheets = new Set(
    addWorksheetNames(suppBody).filter((n) => n !== 'README' && n !== '__reference_values'),
  );
  const expectedSupp = new Set(['compensation', 'bankaccounts', 'recurringdeductions', 'payrolleligibility']);
  if (suppSheets.size !== expectedSupp.size || ![...expectedSupp].every((s) => suppSheets.has(s))) {
    fail(`Supplemental template sheets ${[...suppSheets].sort()} must equal ${[...expectedSupp].sort()}`);
  }

  const obSheets = new Set(addWorksheetNames(obBody).filter((n) => n !== 'README'));
  const expectedOb = new Set(['payrollopeningbalances', 'leavebalances', 'loanbalances']);
  if (obSheets.size !== expectedOb.size || ![...expectedOb].every((s) => obSheets.has(s))) {
    fail(`Opening balances template sheets ${[...obSheets].sort()} must equal ${[...expectedOb].sort()}`);
  }

  const typesSupp = read(path.join(REPO, 'src/modules/data-imports/payroll-supplemental/payroll-supplemental-import.types.ts'));
  const sh = typesSupp.match(/export const SUPPLEMENTAL_SHEETS = \{([\s\S]*?)\} as const;/);
  if (!sh) fail('Could not parse SUPPLEMENTAL_SHEETS');
  const suppKeyToTab = new Map<string, string>();
  for (const m of sh[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
    suppKeyToTab.set(m[1], m[2]);
  }
  const reqSheets = typesSupp.match(/export const REQUIRED_SHEETS = \[([\s\S]*?)\];/);
  if (!reqSheets) fail('Could not parse REQUIRED_SHEETS from payroll-supplemental-import.types.ts');
  const parserSheets = new Set<string>();
  for (const m of reqSheets[1].matchAll(/SUPPLEMENTAL_SHEETS\.(\w+)/g)) {
    const tab = suppKeyToTab.get(m[1]);
    if (!tab) fail(`Unknown SUPPLEMENTAL_SHEETS key ${m[1]}`);
    parserSheets.add(tab);
  }
  if (parserSheets.size !== expectedSupp.size || ![...expectedSupp].every((s) => parserSheets.has(s))) {
    fail(`Supplemental parser REQUIRED_SHEETS ${[...parserSheets].sort()} must equal ${[...expectedSupp].sort()}`);
  }

  const typesOb = read(path.join(REPO, 'src/modules/data-imports/payroll-opening-balances/payroll-opening-balances-import.types.ts'));
  const obConst = typesOb.match(/export const OB_SHEETS = \{([\s\S]*?)\} as const;/);
  if (!obConst) fail('Could not parse OB_SHEETS');
  const obParser = new Set([...obConst[1].matchAll(/:\s*'([^']+)'/g)].map((x) => x[1]));
  if (obParser.size !== expectedOb.size || ![...expectedOb].every((s) => obParser.has(s))) {
    fail(`OB parser OB_SHEETS values ${[...obParser].sort()} must equal ${[...expectedOb].sort()}`);
  }
}

function checkSupplementalTemplateUsesReferenceData(): void {
  const tmplPath = path.join(REPO, 'src/modules/payroll/template-generation.service.ts');
  const tmpl = read(tmplPath);
  const suppBody = extractSupplementalTemplateBody(tmpl);
  if (!suppBody.includes('__reference_values')) {
    fail('Supplemental template must include hidden __reference_values sheet for dropdowns.');
  }
  if (!suppBody.includes('getReferenceData')) {
    fail('Supplemental template generation must call payrollService.getReferenceData().');
  }
  const lines = suppBody.split('\n');
  for (const line of lines) {
    if (!line.includes('formulae:')) continue;
    if (line.includes('formulae:') && !line.includes('__reference_values')) {
      fail(`Supplemental template dataValidation must reference __reference_values (found: ${line.trim()})`);
    }
  }
}

function checkUiPrecheckGates(): void {
  const supp = read(path.join(REPO, 'admin-portal/src/pages/PayrollSupplementalImport.tsx'));
  if (!supp.includes('canUploadToServer')) fail('Supplemental console must define canUploadToServer gate.');
  if (!supp.includes('disabled={!canUploadToServer')) fail('Supplemental server upload must be disabled when canUploadToServer is false.');
  if (!supp.includes('precheckResult?.ready') && !supp.includes('precheckResult && precheckResult.ready')) {
    fail('Supplemental console must gate server upload on precheckResult.ready === true.');
  }

  const ob = read(path.join(REPO, 'admin-portal/src/pages/PayrollOpeningBalancesImport.tsx'));
  if (!ob.includes('canUploadToServer')) fail('OB console must define canUploadToServer gate.');
  if (!ob.includes('disabled={!canUploadToServer')) fail('OB server upload must be disabled when canUploadToServer is false.');
  if (!ob.includes('precheckResult?.ready') && !ob.includes('precheckResult && precheckResult.ready')) {
    fail('OB console must gate server upload on precheck ready === true.');
  }
  if (!ob.includes('totalsReviewed')) fail('OB console must track totalsReviewed.');
  if (!ob.includes('!totalsReviewed') || !ob.includes('Publish opening balances')) {
    fail('OB publish must require totals review checkbox before enabling publish.');
  }
}

function checkGroupedWorkbookSheets(): void {
  const src = read(path.join(REPO, 'src/modules/data-imports/utils/export-errors.ts'));
  const required = ['Summary', 'Errors', 'Warnings', 'Reference Values', 'How to Fix'];
  for (const name of required) {
    if (!src.includes(`'${name}'`)) {
      fail(`export-errors validation workbook must still append sheet '${name}'.`);
    }
  }
}

function checkReadinessWording(): void {
  const p = path.join(REPO, 'admin-portal/src/components/payroll/PayrollReadinessCard.tsx');
  const t = read(p);
  if (t.includes('Missing Tax Profiles') || t.includes('Tax profiles complete')) {
    fail('PayrollReadinessCard must not use legacy "Tax profiles" readiness copy.');
  }
  if (!t.includes('Tax identity')) fail('PayrollReadinessCard must include "Tax identity" label.');
  if (!t.includes('Tax numbers')) fail('PayrollReadinessCard must include "Tax numbers" label.');
}

function main(): void {
  checkNoTaxprofilesResurrection();
  checkTemplateParserParity();
  checkSupplementalTemplateUsesReferenceData();
  checkUiPrecheckGates();
  checkGroupedWorkbookSheets();
  checkReadinessWording();
  console.log('[check:payroll-import-drift] OK');
}

main();
