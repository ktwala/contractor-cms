/**
 * PR-PAYRUN-GOV-META-2 — Governance health of governance (constitution compliance drift).
 * Run: npm run check:payroll-governance-constitution-drift
 *
 * Verifies each GOV slice and the CONTAINER vertical still have: Master Index heading, pillar doc(s), LOCK markers,
 * drift script on disk + package.json, CI invocation, and primary test files.
 * Missing items are reported as governance debt and fail CI.
 *
 * Registry must stay aligned with docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md (GOV-1 … GOV-7 + CONTAINER).
 * Doc anchors: PR-PAYRUN-GOV-META-2-LOCK, PR-PAYROLL-CONTAINER-META-1 in docs/PAYROLL_GOVERNANCE_CONSTITUTION.md;
 *   PR-PAYROLL-V1-2 + footprint line in docs/PAYROLL_GOVERNANCE_VERSION_1.md (PR-PAYROLL-V1-2A).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payroll-governance-constitution-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function exists(p: string): boolean {
  return fs.existsSync(p);
}

type SliceSpec = {
  id: string;
  /** Must appear as a heading line in the Master Index (substring match on a line). */
  masterIndexLineIncludes: string;
  pillarDocs: { rel: string; mustContainOneOf: string[] }[];
  driftBasename: string;
  npmScript: string;
  /** Substring that must appear in .github/workflows/ci.yml */
  ciIncludes: string;
  /** Extra CI signal (second job name or step) — optional */
  ciAlsoIncludes?: string;
  testPaths: string[];
};

const MASTER_INDEX = path.join(REPO, 'docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md');
const CONTROL_PLANE = path.join(REPO, 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md');
const CI_YML = path.join(REPO, '.github/workflows/ci.yml');
const PKG_JSON = path.join(REPO, 'package.json');
const CONSTITUTION = path.join(REPO, 'docs/PAYROLL_GOVERNANCE_CONSTITUTION.md');
const VERSION_V1_DECLARATION = path.join(REPO, 'docs/PAYROLL_GOVERNANCE_VERSION_1.md');

const SLICES: SliceSpec[] = [
  {
    id: 'GOV-1',
    masterIndexLineIncludes: '## GOV-1 —',
    pillarDocs: [
      {
        rel: 'docs/PAYROLL_IMPORTS.md',
        mustContainOneOf: ['Payroll import baseline', 'check:payroll-import-drift'],
      },
    ],
    driftBasename: 'check_payroll_import_drift.ts',
    npmScript: 'check:payroll-import-drift',
    ciIncludes: 'npm run check:payroll-import-drift',
    ciAlsoIncludes: 'payroll-import-e2e:',
    testPaths: [
      'src/modules/data-imports/__tests__/payroll-import-contract.spec.ts',
      'test/playwright/payroll-import-consoles.spec.ts',
    ],
  },
  {
    id: 'GOV-2',
    masterIndexLineIncludes: '## GOV-2 —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_EXECUTION.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-2', 'baseline locked'],
      },
    ],
    driftBasename: 'check_payrun_execution_drift.ts',
    npmScript: 'check:payrun-execution-drift',
    ciIncludes: 'npm run check:payrun-execution-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-readiness-gate.spec.ts',
      'admin-portal/src/utils/payrunExecutionClient.test.ts',
    ],
  },
  {
    id: 'GOV-2B',
    masterIndexLineIncludes: '### GOV-2B —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_CANCEL.md',
        mustContainOneOf: ['PR-PAYRUN-CANCEL-1', 'Governed payrun cancellation'],
      },
    ],
    driftBasename: 'check_payrun_cancel_drift.ts',
    npmScript: 'check:payrun-cancel-drift',
    ciIncludes: 'npm run check:payrun-cancel-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-cancel.service.spec.ts',
      'admin-portal/src/utils/payrunCancelClient.test.ts',
    ],
  },
  {
    id: 'GOV-3A',
    masterIndexLineIncludes: '### GOV-3A —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_FINANCIAL_CONTROL.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-3A-LOCK', 'Financial control baseline locked'],
      },
    ],
    driftBasename: 'check_payrun_financial_control_drift.ts',
    npmScript: 'check:payrun-financial-control-drift',
    ciIncludes: 'npm run check:payrun-financial-control-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-financial-control.spec.ts',
      'admin-portal/src/utils/payrunFinancialControlClient.test.ts',
    ],
  },
  {
    id: 'GOV-3B',
    masterIndexLineIncludes: '### GOV-3B —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_BANK_RECONCILIATION.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-3B-LOCK', 'Bank reconciliation baseline locked'],
      },
    ],
    driftBasename: 'check_payrun_bank_reconciliation_drift.ts',
    npmScript: 'check:payrun-bank-reconciliation-drift',
    ciIncludes: 'npm run check:payrun-bank-reconciliation-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-bank-reconciliation.spec.ts',
      'admin-portal/src/utils/payrunBankReconciliationClient.test.ts',
    ],
  },
  {
    id: 'GOV-3C',
    masterIndexLineIncludes: '### GOV-3C —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GL_RECONCILIATION.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-3C-LOCK', 'GL reconciliation baseline locked'],
      },
    ],
    driftBasename: 'check_payrun_gl_reconciliation_drift.ts',
    npmScript: 'check:payrun-gl-reconciliation-drift',
    ciIncludes: 'npm run check:payrun-gl-reconciliation-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-gl-reconciliation.spec.ts',
      'admin-portal/src/utils/payrunGlReconciliationClient.test.ts',
    ],
  },
  {
    id: 'GOV-3D',
    masterIndexLineIncludes: '### GOV-3D —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-3D-LOCK', 'PR-PAYRUN-GOV-3D-2-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_closed_period_drift.ts',
    npmScript: 'check:payrun-closed-period-drift',
    ciIncludes: 'npm run check:payrun-closed-period-drift',
    testPaths: [
      'src/modules/payruns/__tests__/payrun-closed-period-mutation-guard.service.spec.ts',
      'src/modules/payruns/__tests__/payrun-reversal-workflow.service.spec.ts',
      'src/modules/payruns/__tests__/payrun-correction-approval.service.spec.ts',
    ],
  },
  {
    id: 'GOV-4',
    masterIndexLineIncludes: '## GOV-4 —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_POST_REVERSAL_IMPACT.md',
        mustContainOneOf: ['GOV-4-LOCK', 'PR-PAYRUN-GOV-4-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_post_reversal_impact_drift.ts',
    npmScript: 'check:payrun-post-reversal-impact-drift',
    ciIncludes: 'npm run check:payrun-post-reversal-impact-drift',
    testPaths: ['src/modules/payruns/__tests__/payrun-post-close-reconciliation-impact.service.spec.ts'],
  },
  {
    id: 'GOV-5A',
    masterIndexLineIncludes: '**GOV-5A**',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-5A-LOCK', 'GOV-5A-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_governance_dashboard_drift.ts',
    npmScript: 'check:payrun-governance-dashboard-drift',
    ciIncludes: 'npm run check:payrun-governance-dashboard-drift',
    testPaths: ['src/modules/payruns/__tests__/payrun-governance-health.service.spec.ts'],
  },
  {
    id: 'GOV-5B',
    masterIndexLineIncludes: '**GOV-5B**',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-5B-LOCK', 'GOV-5B-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_governance_portfolio_drift.ts',
    npmScript: 'check:payrun-governance-portfolio-drift',
    ciIncludes: 'npm run check:payrun-governance-portfolio-drift',
    testPaths: ['src/modules/payroll-cycle/__tests__/payroll-governance-portfolio.service.spec.ts'],
  },
  {
    id: 'GOV-5C',
    masterIndexLineIncludes: '**GOV-5C**',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-5C-LOCK', 'GOV-5C-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_governance_portfolio_drift.ts',
    npmScript: 'check:payrun-governance-portfolio-drift',
    ciIncludes: 'npm run check:payrun-governance-portfolio-drift',
    testPaths: [
      'src/modules/payroll-cycle/__tests__/payroll-governance-portfolio-evidence-export.service.spec.ts',
    ],
  },
  {
    id: 'GOV-6',
    masterIndexLineIncludes: '## GOV-6 —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['### GOV-6A', 'PR-PAYRUN-GOV-6A'],
      },
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-6B-LOCK', 'GOV-6B-LOCK'],
      },
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-6C-LOCK', 'GOV-6C-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_governance_policy_drift.ts',
    npmScript: 'check:payrun-governance-policy-drift',
    ciIncludes: 'npm run check:payrun-governance-policy-drift',
    testPaths: [
      'src/modules/payroll-cycle/__tests__/payroll-governance-policy.service.spec.ts',
      'src/modules/payroll-cycle/__tests__/governance-policy-value.validator.spec.ts',
      'src/modules/payruns/__tests__/payrun-governance-policy-resolution.service.spec.ts',
    ],
  },
  {
    id: 'GOV-7',
    masterIndexLineIncludes: '## GOV-7 —',
    pillarDocs: [
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-7A-LOCK', 'GOV-7A-LOCK'],
      },
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-7B-LOCK', 'GOV-7B-LOCK'],
      },
      {
        rel: 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md',
        mustContainOneOf: ['PR-PAYRUN-GOV-7B-2-LOCK', 'GOV-7B-2-LOCK'],
      },
    ],
    driftBasename: 'check_payrun_governance_policy_drift.ts',
    npmScript: 'check:payrun-governance-policy-drift',
    ciIncludes: 'npm run check:payrun-governance-policy-drift',
    testPaths: [
      'src/modules/payroll-cycle/__tests__/governance-policy-payload-hash.spec.ts',
      'test/playwright/governance-policies-admin.spec.ts',
    ],
  },
  {
    id: 'CONTAINER',
    masterIndexLineIncludes: '## CONTAINER —',
    pillarDocs: [
      {
        rel: 'docs/PAYROLL_CONTAINER_GOVERNANCE.md',
        mustContainOneOf: ['PR-PAYROLL-CONTAINER-4-LOCK', 'Container lifecycle baseline locked'],
      },
    ],
    driftBasename: 'check_payroll_container_drift.ts',
    npmScript: 'check:payroll-container-drift',
    ciIncludes: 'npm run check:payroll-container-drift',
    testPaths: ['src/modules/payroll-containers/__tests__/payroll-container-lifecycle.policy.spec.ts'],
  },
];

function assertMasterIndexHeading(idx: string, needle: string): void {
  const lines = idx.split('\n');
  const hit = lines.some((l) => l.includes(needle));
  if (!hit) {
    fail(`Master Index missing heading/anchor for slice: expected a line containing ${JSON.stringify(needle)}`);
  }
}

function main(): void {
  const masterIndex = read(MASTER_INDEX);
  const ci = read(CI_YML);
  const pkg = read(PKG_JSON);
  const constitution = read(CONSTITUTION);

  if (!constitution.includes('PR-PAYRUN-GOV-META-1')) {
    fail('docs/PAYROLL_GOVERNANCE_CONSTITUTION.md must reference PR-PAYRUN-GOV-META-1.');
  }
  if (!constitution.includes('PR-PAYROLL-CONTAINER-META-1')) {
    fail('docs/PAYROLL_GOVERNANCE_CONSTITUTION.md must document PR-PAYROLL-CONTAINER-META-1.');
  }
  if (!masterIndex.includes('PAYROLL_CONTAINER_GOVERNANCE.md')) {
    fail('Master Index must reference docs/PAYROLL_CONTAINER_GOVERNANCE.md (CONTAINER / PR-PAYROLL-CONTAINER-META-1).');
  }
  if (!constitution.includes('PR-PAYRUN-GOV-META-2')) {
    fail('docs/PAYROLL_GOVERNANCE_CONSTITUTION.md must document PR-PAYRUN-GOV-META-2 (executable constitution drift).');
  }
  if (!constitution.includes('PR-PAYRUN-GOV-META-2-LOCK')) {
    fail('docs/PAYROLL_GOVERNANCE_CONSTITUTION.md must document PR-PAYRUN-GOV-META-2-LOCK (constitution drift baseline locked).');
  }
  if (!constitution.includes('Constitution drift baseline locked')) {
    fail('docs/PAYROLL_GOVERNANCE_CONSTITUTION.md must retain META-2-LOCK baseline title text.');
  }
  if (!masterIndex.includes('PAYROLL_GOVERNANCE_CONSTITUTION.md')) {
    fail('Master Index must link to PAYROLL_GOVERNANCE_CONSTITUTION.md (GOV-META-1).');
  }
  if (!masterIndex.includes('check_payroll_governance_constitution_drift.ts')) {
    fail('Master Index drift table must list check_payroll_governance_constitution_drift.ts (META-2 self-map).');
  }

  const selfDrift = path.join(REPO, 'scripts/check_payroll_governance_constitution_drift.ts');
  if (!exists(selfDrift)) {
    fail('META-2 drift script must exist at scripts/check_payroll_governance_constitution_drift.ts');
  }
  if (!pkg.includes('check:payroll-governance-constitution-drift')) {
    fail('package.json must define npm script check:payroll-governance-constitution-drift.');
  }
  if (!ci.includes('npm run check:payroll-governance-constitution-drift')) {
    fail('.github/workflows/ci.yml must run npm run check:payroll-governance-constitution-drift.');
  }

  const versionV1Path = VERSION_V1_DECLARATION;
  if (!exists(versionV1Path)) {
    fail('docs/PAYROLL_GOVERNANCE_VERSION_1.md must exist (PR-PAYROLL-V1-2A).');
  }
  const versionV1 = read(versionV1Path);
  if (!versionV1.includes('PR-PAYROLL-V1-2')) {
    fail(
      'docs/PAYROLL_GOVERNANCE_VERSION_1.md must retain PR-PAYROLL-V1-2 (Version 1 declaration drift anchor — PR-PAYROLL-V1-2A).',
    );
  }
  if (!versionV1.includes('GOV-1 … GOV-7 + CONTAINER + META-2')) {
    fail(
      'docs/PAYROLL_GOVERNANCE_VERSION_1.md must retain single-line footprint "GOV-1 … GOV-7 + CONTAINER + META-2" (PR-PAYROLL-V1-2A).',
    );
  }

  for (const slice of SLICES) {
    assertMasterIndexHeading(masterIndex, slice.masterIndexLineIncludes);
    if (!masterIndex.includes(slice.driftBasename)) {
      fail(`${slice.id}: Master Index must mention drift script ${slice.driftBasename} (governance debt: map drift).`);
    }

    const driftPath = path.join(REPO, 'scripts', slice.driftBasename);
    if (!exists(driftPath)) {
      fail(`${slice.id}: drift script missing: scripts/${slice.driftBasename}`);
    }
    if (!pkg.includes(`"${slice.npmScript}"`)) {
      fail(`${slice.id}: package.json must wire npm script "${slice.npmScript}".`);
    }
    if (!ci.includes(slice.ciIncludes)) {
      fail(`${slice.id}: CI must include ${JSON.stringify(slice.ciIncludes)}`);
    }
    if (slice.ciAlsoIncludes && !ci.includes(slice.ciAlsoIncludes)) {
      fail(`${slice.id}: CI must include ${JSON.stringify(slice.ciAlsoIncludes)}`);
    }

    for (const doc of slice.pillarDocs) {
      const abs = path.join(REPO, doc.rel);
      if (!exists(abs)) {
        fail(`${slice.id}: pillar doc missing: ${doc.rel}`);
      }
      const body = read(abs);
      const ok = doc.mustContainOneOf.some((s) => body.includes(s));
      if (!ok) {
        fail(
          `${slice.id}: ${doc.rel} must contain at least one LOCK/baseline token from ${JSON.stringify(doc.mustContainOneOf)}`,
        );
      }
    }

    for (const tp of slice.testPaths) {
      const abs = path.join(REPO, tp);
      if (!exists(abs)) {
        fail(`${slice.id}: test file missing (governance debt): ${tp}`);
      }
    }
  }

  const plane = read(CONTROL_PLANE);
  if (!plane.includes('PAYROLL_GOVERNANCE_MASTER_INDEX.md')) {
    fail('PAYRUN_GOVERNANCE_CONTROL_PLANE.md Related section must link to PAYROLL_GOVERNANCE_MASTER_INDEX.md.');
  }
  if (!plane.includes('PAYROLL_GOVERNANCE_CONSTITUTION.md')) {
    fail('PAYRUN_GOVERNANCE_CONTROL_PLANE.md Related section must link to PAYROLL_GOVERNANCE_CONSTITUTION.md.');
  }

  console.log(
    `[check:payroll-governance-constitution-drift] OK — ${SLICES.length} registered slices (GOV-1 … GOV-7 + CONTAINER) + META-2 wiring are constitution-compliant.`,
  );
}

main();
