/**
 * PR-PAYRUN-GOV-5A — governance dashboard / control plane drift (CI).
 * Run: npm run check:payrun-governance-dashboard-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-governance-dashboard-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const svc = read(path.join(REPO, 'src/modules/payruns/payrun-governance-health.service.ts'));
  const dto = read(path.join(REPO, 'src/modules/payruns/dto/payrun-governance-health.dto.ts'));
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const mod = read(path.join(REPO, 'src/modules/payruns/payruns.module.ts'));
  const ui = read(path.join(REPO, 'admin-portal/src/pages/PayrunGovernanceDashboard.tsx'));
  const detail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const app = read(path.join(REPO, 'admin-portal/src/App.tsx'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md'));
  const spec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-governance-health.service.spec.ts'));
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!dto.includes('PayrunGovernanceHealthDto') || !dto.includes('overall_governance_rag')) {
    fail('payrun-governance-health.dto.ts must define PayrunGovernanceHealthDto with overall roll-up.');
  }
  const dtoSignals = [
    'readiness_status',
    'financial_control_status',
    'bank_reconciliation_status',
    'gl_reconciliation_status',
    'closed_period_status',
    'reversal_status',
    'post_close_impact_status',
    'override_count',
    'override_types',
    'unresolved_governance_blocks',
  ];
  for (const s of dtoSignals) {
    if (!dto.includes(s)) {
      fail(`PayrunGovernanceHealthDto must include GOV-2/3A/3B/3C/3D/4 signal field: ${s}`);
    }
  }
  if (!svc.includes('getHealthForPayrun') || !svc.includes('PayrunGovernanceHealthService')) {
    fail('PayrunGovernanceHealthService must implement getHealthForPayrun.');
  }
  if (!svc.includes('unresolved_governance_blocks') || !svc.includes('auditLog')) {
    fail('PayrunGovernanceHealthService must aggregate unresolved_governance_blocks and audit (overrides).');
  }
  if (!controller.includes('governance-health') || !controller.includes('PayrunGovernanceHealthService')) {
    fail('PayrunsController must expose GET governance-health and inject PayrunGovernanceHealthService.');
  }
  if (!mod.includes('PayrunGovernanceHealthService')) {
    fail('PayrunsModule must register PayrunGovernanceHealthService.');
  }
  if (!ui.includes('Truth ladder') || !ui.includes('/governance-health')) {
    fail('PayrunGovernanceDashboard must visualize truth ladder and call governance-health API.');
  }
  if (!ui.includes('unresolved_governance_blocks')) {
    fail('PayrunGovernanceDashboard must surface unresolved_governance_blocks from API contract.');
  }
  if (!detail.includes('/governance') || !detail.includes('Governance cockpit')) {
    fail('PayrunDetail must link to governance cockpit route.');
  }
  if (!app.includes('PayrunGovernanceDashboard') || !app.includes('/payroll/payruns/:id/governance')) {
    fail('App.tsx must register PayrunGovernanceDashboard route.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5') || !doc.includes('check:payrun-governance-dashboard-drift')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-5 and drift script.');
  }
  if (!doc.includes('GOV-5B')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must cross-link GOV-5B portfolio (control plane chain).');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5B-LOCK')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-5B-LOCK (portfolio baseline).');
  }
  if (!doc.includes('## GOV-5C')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-5C evidence export (control plane chain).');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5C-LOCK')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-5C-LOCK (export baseline).');
  }
  if (!doc.includes('## GOV-6')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-6 policy layer (roadmap).');
  }
  if (!doc.includes('PR-PAYRUN-GOV-6B-LOCK')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-6B-LOCK (policy enforcement baseline).');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5A-LOCK')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-5A-LOCK baseline.');
  }
  if (
    !doc.includes('payrun-governance-health.service.spec.ts') ||
    !doc.includes('Forbidden regressions') ||
    !doc.includes('Ownership rule')
  ) {
    fail('GOV-5A-LOCK doc must list spec file, forbidden regressions, and ownership rule.');
  }
  if (!spec.includes('GOV-5A-LOCK') || !spec.includes('getHealthForPayrun')) {
    fail('payrun-governance-health.service.spec.ts must cover GOV-5A-LOCK and getHealthForPayrun.');
  }
  if (!pkg.includes('check:payrun-governance-dashboard-drift')) {
    fail('package.json must register check:payrun-governance-dashboard-drift.');
  }
  if (!ci.includes('check:payrun-governance-dashboard-drift')) {
    fail('CI workflow must run check:payrun-governance-dashboard-drift.');
  }

  console.log('[check:payrun-governance-dashboard-drift] OK');
}

main();
