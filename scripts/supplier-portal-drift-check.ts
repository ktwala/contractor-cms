/**
 * PR-SUPPLIER-PORTAL-DATA-1 — supplier portal truthfulness drift checks.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const PORTAL_PAGE_ROOTS = [
  'frontend/app/supplier-portal',
  'frontend/components/dashboard/SupplierPortalDashboardSummary.tsx',
].map((p) => path.join(REPO_ROOT, p));

const FORBIDDEN_COPY: { regex: RegExp; hint: string }[] = [
  {
    regex: /Failed to load supplier profile/i,
    hint: 'generic profile load failure copy',
  },
  {
    regex: /Failed to load your supplier contractors/i,
    hint: 'generic contractors load failure copy',
  },
  {
    regex: /Failed to load timesheets for your contractors/i,
    hint: 'generic timesheets load failure copy',
  },
  {
    regex: /Failed to load dashboard data/i,
    hint: 'generic dashboard failure copy on portal path',
  },
  {
    regex: /Supplier form would go here/i,
    hint: 'supplier form placeholder',
  },
];

const REQUIRED_PATTERNS: { file: string; regex: RegExp; hint: string }[] = [
  {
    file: 'frontend/lib/supplier-portal-response.ts',
    regex: /unwrapSupplierPortalList/,
    hint: 'list envelope parser',
  },
  {
    file: 'backend/src/domain/supplier-portal/supplier-portal.errors.ts',
    regex: /SUPPLIER_MEMBERSHIP_REQUIRED/,
    hint: 'membership error code',
  },
];

function collectFiles(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    out.push(...collectFiles(path.join(target, entry.name)));
  }
  return out.filter((f) => /\.(tsx?|jsx?)$/.test(f));
}

const errors: string[] = [];

for (const root of PORTAL_PAGE_ROOTS) {
  for (const file of collectFiles(root)) {
    const rel = path.relative(REPO_ROOT, file);
    if (rel.endsWith('supplier-portal-drift-check.ts')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line: string, index: number) => {
      for (const { regex, hint } of FORBIDDEN_COPY) {
        if (regex.test(line) && !line.includes('isSupplierPortalLoadFailure')) {
          errors.push(`${rel}:${index + 1} — ${hint}\n    ${line.trim()}`);
        }
      }

      if (
        /bg-red-50/.test(line) &&
        /empty_state|length === 0|items\.length === 0/.test(content) === false &&
        /isSupplierPortalLoadFailure|server could not/i.test(content) === false
      ) {
        // warn only via separate pass — skip noisy heuristic
      }
    });

    if (
      rel.includes('supplier-portal/') &&
      content.includes('bg-red-50') &&
      !content.includes('isSupplierPortalLoadFailure')
    ) {
      errors.push(
        `${rel} — red error banner without isSupplierPortalLoadFailure guard`,
      );
    }
  }
}

for (const { file, regex, hint } of REQUIRED_PATTERNS) {
  const full = path.join(REPO_ROOT, file);
  if (!fs.existsSync(full) || !regex.test(fs.readFileSync(full, 'utf8'))) {
    errors.push(`Missing ${hint} in ${file}`);
  }
}

console.log('Supplier portal data drift check (PR-SUPPLIER-PORTAL-DATA-1)...\n');

if (errors.length === 0) {
  console.log('✅ Supplier portal truthfulness checks passed.');
  process.exit(0);
}

console.error(`❌ ${errors.length} supplier portal drift error(s):\n`);
errors.forEach((e: string) => console.error(`  - ${e}\n`));
process.exit(1);
