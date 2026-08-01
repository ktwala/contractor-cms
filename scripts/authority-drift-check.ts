/**
 * PR-CMS-AUTHORITY-1 — multi-source governance drift checks.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const errors: string[] = [];

function read(rel: string): string {
  const full = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function mustInclude(rel: string, pattern: RegExp, hint: string) {
  const content = read(rel);
  if (content && !pattern.test(content)) {
    errors.push(`${rel} — ${hint}`);
  }
}

function mustNotIncludeInRoots(
  roots: string[],
  pattern: RegExp,
  hint: string,
) {
  for (const root of roots) {
    const target = path.join(REPO_ROOT, root);
    if (!fs.existsSync(target)) continue;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const rel = path.relative(REPO_ROOT, full);
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line: string, i: number) => {
            if (pattern.test(line)) {
              errors.push(`${rel}:${i + 1} — ${hint}\n    ${line.trim()}`);
            }
          });
        }
      }
    };
    walk(target);
  }
}

// Constitution + schema
mustInclude(
  'docs/business/CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md',
  /ORACLE_ONLY/,
  'constitution must document ORACLE_ONLY supplier mode',
);
mustInclude(
  'backend/prisma/schema.prisma',
  /supplierAuthorityMode/,
  'Organization must define supplierAuthorityMode',
);
mustInclude(
  'backend/src/domain/suppliers/suppliers.service.ts',
  /assertSupplierMasterCreationAllowed/,
  'supplier create must enforce authority guard',
);
mustInclude(
  'backend/src/domain/supplier-sources/supplier-governance-twin-promotion.service.ts',
  /SupplierStatus\.PENDING_APPROVAL/,
  'governance twin promotion must use PENDING_APPROVAL for new twins',
);
mustInclude(
  'backend/src/domain/suppliers/suppliers.service.ts',
  /assertOracleSourceIdentityNotMutated/,
  'supplier update must enforce Oracle source immutability',
);
mustInclude(
  'backend/src/core/authority/supplier-authority.helper.ts',
  /GOVERNANCE_INTAKE/,
  'governance intake permission escape hatch',
);
mustInclude(
  'frontend/lib/tenant-authority.ts',
  /isOracleSupplierAuthority/,
  'frontend tenant authority helper',
);

// Oracle tenants must not expose supplier self-registration copy in portal
mustNotIncludeInRoots(
  ['frontend/app/supplier-portal', 'frontend/components/supplier-portal'],
  /Register Supplier/i,
  'forbidden supplier self-registration copy in supplier portal',
);
mustNotIncludeInRoots(
  ['frontend/app/supplier-portal'],
  /Add Supplier/i,
  'forbidden client supplier master create copy in supplier portal',
);

// PR-CMS-GOV-1E — client suppliers list must gate master create for Oracle tenants
mustInclude(
  'frontend/app/suppliers/page.tsx',
  /canCreateSupplierMaster/,
  'suppliers page must gate create with tenant authority',
);
mustInclude(
  'frontend/app/suppliers/page.tsx',
  /SupplierGovernanceDashboard/,
  'suppliers page must render Oracle governance dashboard',
);
mustNotIncludeInRoots(
  ['frontend/app/suppliers'],
  />\s*Add Supplier\s*</,
  'forbidden raw Add Supplier button copy on suppliers page (use supplierMasterCreateLabel)',
);

// Seed demo client profile
const seed = read('backend/prisma/seed.ts');
if (seed && !/supplierAuthorityMode:\s*'ORACLE_ONLY'/.test(seed)) {
  errors.push('backend/prisma/seed.ts — DEMO org must set supplierAuthorityMode ORACLE_ONLY');
}

if (errors.length > 0) {
  console.error('Authority drift check failed:\n');
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}

console.log('✅ Authority drift check passed (PR-CMS-AUTHORITY-1)');
