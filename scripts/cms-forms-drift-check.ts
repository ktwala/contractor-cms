/**
 * PR-CMS-FORMS-1A — block reintroduction of supplier form scaffolds and bad currency display.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SCAN_ROOTS = [
  'frontend/app',
  'frontend/components',
  'frontend/lib',
  'frontend/pages',
].map((p: string) => path.join(REPO_ROOT, p));

const FORBIDDEN_PATTERNS: { regex: RegExp; hint: string }[] = [
  {
    regex: /Supplier form would go here/i,
    hint: 'supplier modal placeholder copy',
  },
  {
    regex: /Use react-hook-form for full implementation/i,
    hint: 'supplier modal scaffold hint',
  },
  { regex: /\bRNaN\b/, hint: 'literal RNaN in source (use display-format helpers)' },
  {
    regex: /safeReplace\([^)]*\.type[^)]*\)\s*\|\|\s*['"]unknown['"]/,
    hint: 'raw unknown contract type fallback',
  },
];

const SKIP_SUFFIXES = [
  'cms-forms-drift-check.ts',
  'cms-forms-drift.spec.ts',
  'display-format.spec.ts',
  'PR-CMS-FORMS-1_REAL_SUPPLIER_FORMS.md',
];

function collectFiles(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return /\.(tsx?|jsx?|md)$/.test(target) ? [target] : [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    out.push(...collectFiles(path.join(target, entry.name)));
  }
  return out;
}

const errors: string[] = [];

for (const root of SCAN_ROOTS) {
  for (const file of collectFiles(root)) {
    const rel = path.relative(REPO_ROOT, file);
    if (SKIP_SUFFIXES.some((s) => rel.endsWith(s))) continue;
    if (rel.includes('__tests__') && rel.endsWith('.md')) continue;

    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line: string, index: number) => {
      for (const { regex, hint } of FORBIDDEN_PATTERNS) {
        if (regex.test(line)) {
          errors.push(`${rel}:${index + 1} — ${hint}\n    ${line.trim()}`);
        }
      }
    });
  }
}

console.log('EWP forms drift check (PR-CMS-FORMS-1A)...\n');

if (errors.length === 0) {
  console.log('✅ No supplier form placeholder or RNaN drift detected.');
  process.exit(0);
}

console.error(`❌ ${errors.length} EWP forms drift error(s):\n`);
errors.forEach((e: string) => console.error(`  - ${e}\n`));
process.exit(1);
