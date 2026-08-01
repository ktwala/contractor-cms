/**
 * PR-EXTID-SCHEMA-1D — EXTID / substrate drift enforcement (no RBAC, HCM, IGA events, or UI).
 *
 * Encodes selected G-EXTID-* gates from docs/business/IMPLEMENTATION_DRIFT_GATES.md:
 * - G-EXTID-02: forbid IGA_PROVISIONED as platform / workforce lifecycle token in schema, code, migrations
 * - Structural: sponsor accountability only on ContractorEngagement; not on Contractor or Supplier
 * - EXTID additive columns must remain present on Contractor / ContractorEngagement
 * - Every Prisma migration directory must contain migration.sql that is not git-ignored and is tracked
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

console.log('Running EXTID drift checks (PR-EXTID-SCHEMA-1D)...');

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith('scripts')) return path.join(cwd, '..');
  if (cwd.endsWith('backend')) return path.join(cwd, '..');
  return cwd;
}

const projectRoot = resolveProjectRoot();
const SCHEMA_PATH = path.join(projectRoot, 'backend/prisma/schema.prisma');
const MIGRATIONS_DIR = path.join(projectRoot, 'backend/prisma/migrations');
const BACKEND_SRC = path.join(projectRoot, 'backend/src');

let hasError = false;

function reportError(msg: string) {
  console.error(`❌ EXTID DRIFT: ${msg}`);
  hasError = true;
}

/** Body of a Prisma model `{ ... }` using brace depth (handles nested attribute blocks if added later). */
function getPrismaModelBody(schema: string, modelName: string): string {
  const re = new RegExp(`model\\s+${modelName}\\s*\\{`);
  const m = schema.match(re);
  if (!m || m.index === undefined) {
    reportError(`Prisma schema missing model "${modelName}"`);
    return '';
  }
  const open = schema.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < schema.length; i++) {
    const c = schema[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return schema.slice(open + 1, i);
      }
    }
  }
  reportError(`Unterminated model block for "${modelName}"`);
  return '';
}

// ---------------------------------------------------------------------------
// G-EXTID-02 — IGA_PROVISIONED must not appear as platform lifecycle / substrate token
// ---------------------------------------------------------------------------
const IGA_PROVISIONED = /\bIGA_PROVISIONED\b/;

function assertNoIgaProvisioned(filePath: string, content: string) {
  if (IGA_PROVISIONED.test(content)) {
    reportError(
      `G-EXTID-02: forbidden token IGA_PROVISIONED in ${path.relative(projectRoot, filePath)} — do not use as platform workforce lifecycle or integration-plane state`,
    );
  }
}

if (fs.existsSync(SCHEMA_PATH)) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  assertNoIgaProvisioned(SCHEMA_PATH, schema);

  const igaEnum = schema.match(/enum\s+IgaIntegrationPlaneStatus\s*\{([^}]*)\}/s);
  if (igaEnum && IGA_PROVISIONED.test(igaEnum[1])) {
    reportError('G-EXTID-02: IGA_PROVISIONED must not appear inside enum IgaIntegrationPlaneStatus');
  }
} else {
  reportError('Missing backend/prisma/schema.prisma');
}

function walkFiles(root: string, test: (p: string) => boolean, visit: (p: string, content: string) => void) {
  if (!fs.existsSync(root)) return;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walkFiles(full, test, visit);
    } else if (test(full)) {
      visit(full, fs.readFileSync(full, 'utf8'));
    }
  }
}

walkFiles(
  BACKEND_SRC,
  (p) => p.endsWith('.ts') && !p.endsWith('.d.ts'),
  (p, src) => assertNoIgaProvisioned(p, src),
);

if (fs.existsSync(MIGRATIONS_DIR)) {
  for (const ent of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory() || !/^\d{14}_/.test(ent.name)) continue;
    const sqlPath = path.join(MIGRATIONS_DIR, ent.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) {
      reportError(`Missing migration.sql for migration folder ${ent.name}`);
      continue;
    }
    assertNoIgaProvisioned(sqlPath, fs.readFileSync(sqlPath, 'utf8'));
  }
}

// ---------------------------------------------------------------------------
// Sponsor / supplier conflation (schema structure only)
// ---------------------------------------------------------------------------
if (fs.existsSync(SCHEMA_PATH)) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const contractorBody = getPrismaModelBody(schema, 'Contractor');
  if (/\bsponsor/i.test(contractorBody)) {
    reportError(
      'Sponsor fields must not appear on model Contractor — sponsor accountability is placement-level (ContractorEngagement) per PR-EXTID-SCHEMA-1 design',
    );
  }

  const supplierBody = getPrismaModelBody(schema, 'Supplier');
  if (/\bsponsor[A-Za-z]*Id\b|\bsponsorEmployeeId\b|\bsponsorDelegate\b|\bsponsorStatus\b/i.test(supplierBody)) {
    reportError('Sponsor accountability columns must not appear on model Supplier (sponsor/supplier conflation)');
  }

  const engagementBody = getPrismaModelBody(schema, 'ContractorEngagement');
  const requiredEngagementSponsor = [
    'sponsorEmployeeId',
    'sponsorDelegateEmployeeId',
    'sponsorStatus',
  ] as const;
  for (const col of requiredEngagementSponsor) {
    if (!engagementBody.includes(col)) {
      reportError(`ContractorEngagement must retain substrate field "${col}"`);
    }
  }

  if (/\bsupplierSponsorId\b|\bsponsorSupplierId\b|\bsupplierSponsor\b/i.test(schema)) {
    reportError('Forbidden merged sponsor/supplier identifier naming in schema');
  }

  const requiredContractorExtid = [
    'externalPersonId',
    'personType',
    'supplierResourceId',
    'accessIntent',
    'identityRequired',
    'physicalAccessRequired',
    'logicalAccessRequired',
    'igaIntegrationStatus',
    'accessEnablementStatus',
    'igaLastSyncAt',
    'riskTier',
    'workerArchetype',
  ] as const;
  for (const col of requiredContractorExtid) {
    if (!contractorBody.includes(col)) {
      reportError(`Contractor model must retain additive EXTID field "${col}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// migration.sql tracked (CI fresh clone)
// ---------------------------------------------------------------------------
try {
  const tracked = execSync('git ls-files -- backend/prisma/migrations', {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const trackedSet = new Set(
    tracked
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  if (trackedSet.size === 0) {
    reportError('git ls-files returned no backend/prisma/migrations paths — migration SQL may be missing from version control');
  }
  if (fs.existsSync(MIGRATIONS_DIR)) {
    for (const ent of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
      if (!ent.isDirectory() || !/^\d{14}_/.test(ent.name)) continue;
      const rel = posixJoin('backend/prisma/migrations', ent.name, 'migration.sql');
      if (!trackedSet.has(rel)) {
        reportError(
          `migration.sql is not tracked in git: ${rel} — add and commit so migrate deploy works on fresh clones (PR-EXTID-SCHEMA-1D)`,
        );
      }
    }
  }
} catch {
  reportError('git ls-files failed — run this check from a git checkout with git available');
}

function posixJoin(...parts: string[]) {
  return parts.join('/').split(path.sep).join('/');
}

if (hasError) {
  console.error('\n❌ EXTID drift check failed.');
  process.exit(1);
}
console.log('\n✅ EXTID drift checks passed.');
process.exit(0);
