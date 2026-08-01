/**
 * PR-PAYRUN-GOV-3A — register ↔ payment export financial control drift (CI).
 * Run: npm run check:payrun-financial-control-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-financial-control-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const finSvc = read(path.join(REPO, 'src/modules/payruns/payrun-financial-control.service.ts'));
  const batchSvc = read(path.join(REPO, 'src/modules/payments/payment-batch.service.ts'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const client = read(path.join(REPO, 'admin-portal/src/utils/payrunFinancialControlClient.ts'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_FINANCIAL_CONTROL.md'));
  const mainTs = read(path.join(REPO, 'src/main.ts'));
  const beSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-financial-control.spec.ts'));
  const feSpec = read(path.join(REPO, 'admin-portal/src/utils/payrunFinancialControlClient.test.ts'));

  if (!finSvc.includes('payroll.period_close')) {
    fail('PayrunFinancialControlService must allow payroll.period_close operation on financial gate.');
  }
  if (!finSvc.includes('PAYRUN_FINANCIAL_CONTROL_OVERRIDE')) {
    fail('PayrunFinancialControlService must audit PAYRUN_FINANCIAL_CONTROL_OVERRIDE.');
  }
  if (!finSvc.includes('PAYRUN_FINANCIAL_GATE_BLOCKED')) {
    fail('PayrunFinancialControlService must use PAYRUN_FINANCIAL_GATE_BLOCKED.');
  }
  if (!finSvc.includes('post_close_reconciliation_impact_pending')) {
    fail('PayrunFinancialControlService must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!controller.includes('assertAllowsMarkPaidOrPosted')) {
    fail('PayrunsController must call financial gate before mark paid/posted.');
  }
  if (!controller.includes('assertAllowsMarkPostedBankGate')) {
    fail('PayrunsController must call GOV-3B bank gate between financial control and readiness for mark posted.');
  }
  if (!controller.includes('financial-control/reconcile')) {
    fail('PayrunsController must expose financial-control reconcile route.');
  }
  if (!batchSvc.includes('reconcileAfterPaymentExport')) {
    fail('PaymentBatchService must call reconcileAfterPaymentExport after export.');
  }
  if (!seed.includes('payrun:financial_override')) {
    fail('prisma/seed.ts must define payrun:financial_override.');
  }
  if (!mainTs.includes('x-financial-gate-override')) {
    fail('main.ts CORS must allow financial override headers.');
  }
  if (!payrunDetail.includes('FINANCIAL_GATED_PAY_ACTIONS')) {
    fail('PayrunDetail must define FINANCIAL_GATED_PAY_ACTIONS for UI gate alignment.');
  }
  if (!payrunDetail.includes('/financial-control')) {
    fail('PayrunDetail must call financial-control API.');
  }
  if (!client.includes('PAYRUN_FINANCIAL_GATE_BLOCKED')) {
    fail('payrunFinancialControlClient must expose PAYRUN_FINANCIAL_GATE_BLOCKED.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3A') || !doc.includes('check:payrun-financial-control-drift')) {
    fail('docs/PAYRUN_FINANCIAL_CONTROL.md must document GOV-3A and drift script.');
  }
  if (!beSpec.includes('assertAllowsMarkPaidOrPosted')) {
    fail('Backend spec must cover assertAllowsMarkPaidOrPosted.');
  }
  if (!finSvc.includes('GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD')) {
    fail('PayrunFinancialControlService must resolve GOV-6B financial net variance threshold via policy key constant.');
  }
  if (!feSpec.includes('canProceedMarkPaidOrPostedWithFinancialControl')) {
    fail('Frontend spec must cover canProceedMarkPaidOrPostedWithFinancialControl.');
  }

  console.log('[check:payrun-financial-control-drift] OK');
}

main();
