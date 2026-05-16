/**
 * PR-SUPPLIER-RESOURCE-ALIAS-REMOVAL-1 — warn on production-facing "Resources" terminology
 * and flag reintroduced supplier-resources permissions.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SCAN_ROOTS = [
  'frontend/app/supplier-portal',
  'frontend/components/supplier-portal',
  'frontend/lib/protected-routes.ts',
  'frontend/lib/supplier-portal-modules.ts',
  'frontend/components/dashboard-layout.tsx',
].map((p: string) => path.join(REPO_ROOT, p));

const CODE_SCAN_ROOTS = [
  'backend/src',
  'frontend/lib',
  'frontend/app',
  'scripts',
  'backend/test',
].map((p: string) => path.join(REPO_ROOT, p));

const FORBIDDEN_UI_PATTERNS: { regex: RegExp; hint: string }[] = [
  { regex: /name:\s*['"]Resources['"]/, hint: "nav label name: 'Resources'" },
  { regex: /title:\s*['"]Resources['"]/, hint: "module title: 'Resources'" },
  { regex: /title=["']Resources["']/, hint: 'page title "Resources"' },
  { regex: /Nominate resource/i, hint: 'action label "Nominate resource"' },
  { regex: /nominated resources/i, hint: 'copy "nominated resources"' },
  { regex: /No resources yet/i, hint: 'empty state "No resources yet"' },
  { regex: /ResourceNomination/, hint: 'ResourceNomination component name' },
  { regex: /Loading resources/i, hint: 'loading copy "Loading resources"' },
];

const warnings: string[] = [];
const errors: string[] = [];

function collectFiles(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(tsx?|jsx?|sh)$/.test(entry.name)) out.push(full);
  }
  return out;
}

for (const root of SCAN_ROOTS) {
  for (const file of collectFiles(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line: string, index: number) => {
      for (const { regex, hint } of FORBIDDEN_UI_PATTERNS) {
        if (regex.test(line)) {
          warnings.push(
            `${path.relative(REPO_ROOT, file)}:${index + 1} — ${hint}\n    ${line.trim()}`,
          );
        }
      }
    });
  }
}

for (const root of CODE_SCAN_ROOTS) {
  for (const file of collectFiles(root)) {
    if (file.includes('node_modules')) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (/supplier-resources:/.test(content)) {
      const rel = path.relative(REPO_ROOT, file);
      const skip =
        rel.endsWith('supplier-portal-terminology-drift-check.ts') ||
        rel.includes('e2e-spec') ||
        rel.includes('.spec.');
      if (!skip) {
        errors.push(
          `${rel} — contains deprecated supplier-resources:* permission`,
        );
      }
    }
    if (/\/supplier-portal\/resources/.test(content)) {
      const rel = path.relative(REPO_ROOT, file);
      const allowed =
        rel.includes('e2e-spec') ||
        rel.includes('.spec.') ||
        rel.endsWith('validate-supplier-portal.sh') ||
        rel.endsWith('supplier-portal-terminology-drift-check.ts');
      if (!allowed) {
        errors.push(`${rel} — contains removed /supplier-portal/resources route`);
      }
    }
  }
}

const seedBundles = path.join(
  REPO_ROOT,
  'backend/src/core/auth/seed-system-role-bundles.ts',
);
if (fs.existsSync(seedBundles)) {
  const seed = fs.readFileSync(seedBundles, 'utf8');
  if (/supplier-resources:/.test(seed)) {
    errors.push(
      `${path.relative(REPO_ROOT, seedBundles)} — seed bundles must use supplier-contractors:* only`,
    );
  }
}

console.log('Supplier portal terminology drift check...\n');

if (warnings.length === 0) {
  console.log('✅ No production-facing "Resources" UI drift detected.');
} else {
  console.warn(`⚠️  ${warnings.length} UI terminology warning(s):\n`);
  warnings.forEach((w: string) => console.warn(`  - ${w}\n`));
}

if (errors.length === 0) {
  console.log('✅ No deprecated supplier-resources alias in code.');
  process.exit(0);
} else {
  console.error(`❌ ${errors.length} alias drift error(s):\n`);
  errors.forEach((e: string) => console.error(`  - ${e}`));
  process.exit(1);
}
