/**
 * PR-PAYRUN-GOV-4 — post-reversal reconciliation impact drift (CI).
 * Run: npm run check:payrun-post-reversal-impact-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-post-reversal-impact-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const schema = read(path.join(REPO, 'prisma/schema.prisma'));
  const impactSvc = read(path.join(REPO, 'src/modules/payruns/payrun-post-close-reconciliation-impact.service.ts'));
  const reversal = read(path.join(REPO, 'src/modules/payruns/payrun-reversal-workflow.service.ts'));
  const correction = read(path.join(REPO, 'src/modules/payruns/payrun-correction-approval.service.ts'));
  const periodGate = read(path.join(REPO, 'src/modules/payroll-cycle/services/payroll-period-close-gate.service.ts'));
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const fin = read(path.join(REPO, 'src/modules/payruns/payrun-financial-control.service.ts'));
  const bank = read(path.join(REPO, 'src/modules/payruns/payrun-bank-reconciliation.service.ts'));
  const gl = read(path.join(REPO, 'src/modules/payruns/payrun-gl-reconciliation.service.ts'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_POST_REVERSAL_IMPACT.md'));
  const impactSpec = read(
    path.join(REPO, 'src/modules/payruns/__tests__/payrun-post-close-reconciliation-impact.service.spec.ts'),
  );
  const finDrift = read(path.join(REPO, 'scripts/check_payrun_financial_control_drift.ts'));
  const bankDrift = read(path.join(REPO, 'scripts/check_payrun_bank_reconciliation_drift.ts'));
  const glDrift = read(path.join(REPO, 'scripts/check_payrun_gl_reconciliation_drift.ts'));
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!schema.includes('financialControlImpacted') || !schema.includes('downstreamReconciliationRequired')) {
    fail('Prisma schema must define GOV-4 payrun impact + downstream_reconciliation_required fields.');
  }
  if (!impactSvc.includes('PAYRUN_POST_CLOSE_RECON_IMPACT_ACK') || !impactSvc.includes('assertAllowsPeriodClose')) {
    fail('PayrunPostCloseReconciliationImpactService must implement acknowledge + period-close assert.');
  }
  if (!reversal.includes('financialControlImpacted: true') || !reversal.includes('downstreamReconciliationRequired: true')) {
    fail('Reversal link must set source impact flags and downstream_reconciliation_required.');
  }
  if (!correction.includes('financialControlImpacted: true') || !correction.includes('downstreamReconciliationRequired: true')) {
    fail('Correction link must set source impact flags and downstream_reconciliation_required.');
  }
  if (!periodGate.includes('postCloseImpact.assertAllowsPeriodClose')) {
    fail('PayrollPeriodCloseGateService must call post-close impact assert.');
  }
  if (!controller.includes('post-close-reconciliation-impact/acknowledge')) {
    fail('PayrunsController must expose post-close impact acknowledge route.');
  }
  if (!fin.includes('post_close_reconciliation_impact_pending')) {
    fail('Financial control response must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!bank.includes('post_close_reconciliation_impact_pending')) {
    fail('Bank reconciliation response must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!gl.includes('post_close_reconciliation_impact_pending')) {
    fail('GL reconciliation response must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!payrunDetail.includes('Post-close impact (GOV-4)') || !payrunDetail.includes('post-close-reconciliation-impact')) {
    fail('PayrunDetail must render Post-close impact card and call impact API.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-4') || !doc.includes('check:payrun-post-reversal-impact-drift')) {
    fail('docs/PAYRUN_POST_REVERSAL_IMPACT.md must document GOV-4 and drift script.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-4-LOCK')) {
    fail('docs/PAYRUN_POST_REVERSAL_IMPACT.md must document PR-PAYRUN-GOV-4-LOCK baseline.');
  }
  if (
    !doc.includes('payrun-post-close-reconciliation-impact.service.spec.ts') ||
    !doc.includes('check:payrun-financial-control-drift') ||
    !doc.includes('check:payrun-bank-reconciliation-drift') ||
    !doc.includes('check:payrun-gl-reconciliation-drift')
  ) {
    fail('GOV-4-LOCK doc must list impact spec and 3A/3B/3C drift checks.');
  }
  if (!impactSpec.includes('GOV-4-LOCK') || !impactSpec.includes('assertAllowsPeriodClose')) {
    fail('payrun-post-close-reconciliation-impact.service.spec.ts must cover GOV-4-LOCK and period-close assert.');
  }
  if (!impactSpec.includes('PAYRUN_POST_CLOSE_RECON_IMPACT_ACK') || !impactSpec.includes('acknowledgeImpact')) {
    fail('Impact service spec must reference acknowledge audit and acknowledgeImpact.');
  }
  if (!finDrift.includes('post_close_reconciliation_impact_pending')) {
    fail('check_payrun_financial_control_drift.ts must assert post_close_reconciliation_impact_pending (GOV-4-LOCK).');
  }
  if (!bankDrift.includes('post_close_reconciliation_impact_pending')) {
    fail('check_payrun_bank_reconciliation_drift.ts must assert post_close_reconciliation_impact_pending (GOV-4-LOCK).');
  }
  if (!glDrift.includes('post_close_reconciliation_impact_pending')) {
    fail('check_payrun_gl_reconciliation_drift.ts must assert post_close_reconciliation_impact_pending (GOV-4-LOCK).');
  }
  if (!pkg.includes('check:payrun-post-reversal-impact-drift')) {
    fail('package.json must register check:payrun-post-reversal-impact-drift.');
  }
  if (!ci.includes('check:payrun-post-reversal-impact-drift')) {
    fail('CI workflow must run check:payrun-post-reversal-impact-drift.');
  }

  console.log('[check:payrun-post-reversal-impact-drift] OK');
}

main();
