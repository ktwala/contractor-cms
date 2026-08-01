/**
 * PR-PAYRUN-GOV-3C — register ↔ GL posting reconciliation drift (CI).
 * Run: npm run check:payrun-gl-reconciliation-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-gl-reconciliation-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const glSvc = read(path.join(REPO, 'src/modules/payruns/payrun-gl-reconciliation.service.ts'));
  const mod = read(path.join(REPO, 'src/modules/payruns/payruns.module.ts'));
  const periodGate = read(path.join(REPO, 'src/modules/payroll-cycle/services/payroll-period-close-gate.service.ts'));
  const cycleCtrl = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.controller.ts'));
  const cycleMod = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.module.ts'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const payrollCalendars = read(path.join(REPO, 'admin-portal/src/pages/PayrollCalendars.tsx'));
  const periodCloseUi = read(path.join(REPO, 'admin-portal/src/utils/periodCloseGovernanceClient.ts'));
  const periodCloseUiTest = read(path.join(REPO, 'admin-portal/src/utils/periodCloseGovernanceClient.test.ts'));
  const client = read(path.join(REPO, 'admin-portal/src/utils/payrunGlReconciliationClient.ts'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_GL_RECONCILIATION.md'));
  const mainTs = read(path.join(REPO, 'src/main.ts'));
  const beSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-gl-reconciliation.spec.ts'));
  const feSpec = read(path.join(REPO, 'admin-portal/src/utils/payrunGlReconciliationClient.test.ts'));

  if (!mod.includes('PayrunGLReconciliationService')) {
    fail('PayrunsModule must register PayrunGLReconciliationService.');
  }
  if (!glSvc.includes('GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE')) {
    fail('PayrunGLReconciliationService must resolve GOV-6B GL rounding tolerance via policy key constant.');
  }
  if (!glSvc.includes('PAYRUN_GL_RECON_OVERRIDE')) {
    fail('PayrunGLReconciliationService must audit PAYRUN_GL_RECON_OVERRIDE.');
  }
  if (!glSvc.includes('PAYRUN_GL_GATE_BLOCKED')) {
    fail('PayrunGLReconciliationService must use PAYRUN_GL_GATE_BLOCKED.');
  }
  if (!glSvc.includes('post_close_reconciliation_impact_pending')) {
    fail('PayrunGLReconciliationService must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!controller.includes('gl-confirmation/import')) {
    fail('PayrunsController must expose gl-confirmation import route.');
  }
  if (!periodGate.includes('assertAllowsPeriodClose')) {
    fail('PayrollPeriodCloseGateService must define assertAllowsPeriodClose.');
  }
  if (!periodGate.includes('payroll.period_close')) {
    fail('Period close gate must use payroll.period_close operation label.');
  }
  if (!cycleCtrl.includes('periodCloseGate.assertAllowsPeriodClose')) {
    fail('PayrollCycleController closePeriod must invoke period close governance gate.');
  }
  if (!cycleMod.includes('PayrollPeriodCloseGateService')) {
    fail('PayrollCycleModule must register PayrollPeriodCloseGateService.');
  }
  if (!cycleMod.includes('PayrunsModule')) {
    fail('PayrollCycleModule must import PayrunsModule for governance services.');
  }
  if (!seed.includes('payrun:gl_override')) {
    fail('prisma/seed.ts must define payrun:gl_override.');
  }
  if (!mainTs.includes('x-gl-gate-override')) {
    fail('main.ts CORS must allow GL override headers.');
  }
  if (!payrunDetail.includes('/gl-reconciliation')) {
    fail('PayrunDetail must call gl-reconciliation API.');
  }
  if (!client.includes('PAYRUN_GL_GATE_BLOCKED')) {
    fail('payrunGlReconciliationClient must expose PAYRUN_GL_GATE_BLOCKED.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3C') || !doc.includes('check:payrun-gl-reconciliation-drift')) {
    fail('docs/PAYRUN_GL_RECONCILIATION.md must document GOV-3C and drift script.');
  }
  if (!beSpec.includes('assertAllowsPeriodCloseGl')) {
    fail('Backend spec must cover assertAllowsPeriodCloseGl.');
  }
  if (!feSpec.includes('isPayrunGlGateBlockedError')) {
    fail('Frontend spec must cover isPayrunGlGateBlockedError.');
  }

  if (!payrollCalendars.includes('periodCloseGovernanceClient')) {
    fail('PayrollCalendars must import periodCloseGovernanceClient for period-close override parity.');
  }
  if (!payrollCalendars.includes('closePeriodWithGovernance')) {
    fail('PayrollCalendars must use closePeriodWithGovernance for period close.');
  }
  if (!payrollCalendars.includes('buildPeriodCloseOverrideHeaders')) {
    fail('PayrollCalendars must call buildPeriodCloseOverrideHeaders for period close requests.');
  }
  if (!periodCloseUi.includes('buildPeriodCloseOverrideHeaders')) {
    fail('periodCloseGovernanceClient must export buildPeriodCloseOverrideHeaders.');
  }
  if (!periodCloseUi.includes('isPeriodCloseRetryBlocked')) {
    fail('periodCloseGovernanceClient must export isPeriodCloseRetryBlocked.');
  }
  if (!periodCloseUiTest.includes('buildPeriodCloseOverrideHeaders')) {
    fail('periodCloseGovernanceClient.test.ts must cover buildPeriodCloseOverrideHeaders.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3C-UI') || !doc.includes('PayrollCalendars')) {
    fail('docs/PAYRUN_GL_RECONCILIATION.md must document PR-PAYRUN-GOV-3C-UI and PayrollCalendars.');
  }

  console.log('[check:payrun-gl-reconciliation-drift] OK');
}

main();
