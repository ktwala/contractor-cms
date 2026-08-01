/**
 * PR-PAYRUN-GOV-5B / GOV-5C — governance portfolio + evidence export drift (CI).
 * Run: npm run check:payrun-governance-portfolio-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-governance-portfolio-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const svc = read(path.join(REPO, 'src/modules/payroll-cycle/services/payroll-governance-portfolio.service.ts'));
  const dto = read(path.join(REPO, 'src/modules/payroll-cycle/dto/governance-portfolio-summary.dto.ts'));
  const ctrl = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.controller.ts'));
  const mod = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.module.ts'));
  const ui = read(path.join(REPO, 'admin-portal/src/pages/GovernancePortfolio.tsx'));
  const app = read(path.join(REPO, 'admin-portal/src/App.tsx'));
  const layout = read(path.join(REPO, 'admin-portal/src/components/AdminLayout.tsx'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md'));
  const spec = read(path.join(REPO, 'src/modules/payroll-cycle/__tests__/payroll-governance-portfolio.service.spec.ts'));
  const exportSpec = read(
    path.join(REPO, 'src/modules/payroll-cycle/__tests__/payroll-governance-portfolio-evidence-export.service.spec.ts'),
  );
  const exportSvc = read(
    path.join(REPO, 'src/modules/payroll-cycle/services/payroll-governance-portfolio-evidence-export.service.ts'),
  );
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!dto.includes('GovernancePortfolioSummaryDto') || !dto.includes('stale_post_close_impact_count')) {
    fail('governance-portfolio-summary.dto.ts must define portfolio DTO with post-close stale signal.');
  }
  for (const f of [
    'blocked_payruns_count',
    'override_event_count',
    'financial_exception_payruns',
    'bank_exception_payruns',
    'gl_exception_payruns',
  ]) {
    if (!dto.includes(f)) {
      fail(`GovernancePortfolioSummaryDto must include rollup field: ${f}`);
    }
  }
  if (!svc.includes('summarizePeriod') || !svc.includes('PayrollGovernancePortfolioService')) {
    fail('PayrollGovernancePortfolioService must implement period/pay group/entity summaries.');
  }
  if (!svc.includes('assertLegalEntity') || !svc.includes('PAYROLL_GOVERNANCE_PORTFOLIO_DENIED')) {
    fail('Portfolio service must enforce legal entity access (assertLegalEntity + denied code).');
  }
  if (!ctrl.includes('governance-portfolio/periods') || !ctrl.includes('governance-portfolio/legal-entities')) {
    fail('PayrollCycleController must expose governance-portfolio routes.');
  }
  if (
    !ctrl.includes('exportGovernancePortfolioPeriod') ||
    !ctrl.includes('exportGovernancePortfolioPayGroup') ||
    !ctrl.includes('exportGovernancePortfolioLegalEntity')
  ) {
    fail('PayrollCycleController must expose GOV-5C portfolio export handlers for period, pay group, and legal entity.');
  }
  if (!ctrl.includes('PermissionsGuard') || !ctrl.includes('payrun:read')) {
    fail('Portfolio routes must use PermissionsGuard and payrun:read.');
  }
  if (!mod.includes('PayrollGovernancePortfolioService') || !mod.includes('PayrollGovernancePortfolioEvidenceExportService')) {
    fail('PayrollCycleModule must register portfolio and GOV-5C evidence export services.');
  }
  if (!ui.includes('governance-portfolio/periods') || !ui.includes('stale_post_close_impact_count')) {
    fail('GovernancePortfolio page must call portfolio APIs and display stale post-close count.');
  }
  if (!ui.includes('Download .csv') || !ui.includes('Download .xlsx') || !ui.includes('/export')) {
    fail('GovernancePortfolio must offer GOV-5C CSV and XLSX downloads via export paths.');
  }
  for (const f of ['blocked_payruns_count', 'override_event_count', 'financial_exception_payruns']) {
    if (!ui.includes(f)) {
      fail(`GovernancePortfolio UI must surface portfolio field: ${f}`);
    }
  }
  if (!app.includes('GovernancePortfolio') || !app.includes('/payroll/governance-portfolio')) {
    fail('App.tsx must register GovernancePortfolio route.');
  }
  if (!layout.includes('/payroll/governance-portfolio')) {
    fail('AdminLayout must link to governance portfolio.');
  }
  if (!doc.includes('GOV-5B') || !doc.includes('check:payrun-governance-portfolio-drift')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-5B and portfolio drift script.');
  }
  if (!doc.includes('GOV-6A')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must cross-link GOV-6A policy registry.');
  }
  if (!doc.includes('GOV-6B')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must cross-link GOV-6B policy-backed enforcement.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5B-LOCK') || !doc.includes('Governance portfolio baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-5B-LOCK baseline.');
  }
  if (!doc.includes('payroll-governance-portfolio.service.spec.ts') || !doc.includes('Forbidden regressions')) {
    fail('GOV-5B-LOCK doc must list portfolio spec and forbidden regressions.');
  }
  if (!doc.includes('GOV-5C')) {
    fail('GOV-5B-LOCK roadmap must mention GOV-5C (Audit / PMO reporting export).');
  }
  if (!doc.includes('## GOV-5C') || !doc.includes('generated_by') || !doc.includes('PayrollGovernancePortfolioEvidenceExportService')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-5C export slice (metadata + export service).');
  }
  if (!exportSvc.includes('PayrollGovernancePortfolioEvidenceExportService') || !exportSvc.includes('encodeEvidenceReport')) {
    fail('GOV-5C evidence export service must implement encoding.');
  }
  if (!exportSpec.includes('GOV-5C') || !exportSpec.includes('GOV-5C-LOCK')) {
    fail('payroll-governance-portfolio-evidence-export.service.spec.ts must reference GOV-5C and GOV-5C-LOCK.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-5C-LOCK') || !doc.includes('Audit / PMO export baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-5C-LOCK baseline.');
  }
  if (
    !doc.includes('payroll-governance-portfolio-evidence-export.service.spec.ts') ||
    !doc.includes('Chain (locked)') ||
    !doc.includes('Cockpit → Portfolio → Export → Evidence')
  ) {
    fail('GOV-5C-LOCK doc must list export spec and locked control-plane chain.');
  }
  if (!doc.includes('Export bypasses portfolio access checks') || !doc.includes('UI download removed without replacement')) {
    fail('GOV-5C-LOCK doc must list export forbidden regressions.');
  }
  if (!doc.includes('Portfolio service') || !doc.includes('export service') || !doc.includes('GOV-5C-LOCK')) {
    fail('GOV-5C-LOCK doc must state ownership rule (portfolio + export surfaces).');
  }
  if (!exportSvc.includes('this.portfolio.summarizePeriod') || !exportSvc.includes('buildEvidenceRow')) {
    fail('Export service must delegate rollups to portfolio service and build evidence row.');
  }
  if (!spec.includes('GOV-5B-LOCK')) {
    fail('payroll-governance-portfolio.service.spec.ts must reference GOV-5B-LOCK.');
  }
  if (!pkg.includes('check:payrun-governance-portfolio-drift')) {
    fail('package.json must register check:payrun-governance-portfolio-drift.');
  }
  if (!ci.includes('check:payrun-governance-portfolio-drift')) {
    fail('CI workflow must run check:payrun-governance-portfolio-drift.');
  }

  console.log('[check:payrun-governance-portfolio-drift] OK');
}

main();
