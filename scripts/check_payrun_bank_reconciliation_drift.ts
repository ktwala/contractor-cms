/**
 * PR-PAYRUN-GOV-3B — payment export vs bank confirmation drift (CI).
 * Run: npm run check:payrun-bank-reconciliation-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-bank-reconciliation-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const bankSvc = read(path.join(REPO, 'src/modules/payruns/payrun-bank-reconciliation.service.ts'));
  const mod = read(path.join(REPO, 'src/modules/payruns/payruns.module.ts'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const client = read(path.join(REPO, 'admin-portal/src/utils/payrunBankReconciliationClient.ts'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_BANK_RECONCILIATION.md'));
  const mainTs = read(path.join(REPO, 'src/main.ts'));
  const beSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-bank-reconciliation.spec.ts'));
  const feSpec = read(path.join(REPO, 'admin-portal/src/utils/payrunBankReconciliationClient.test.ts'));

  if (!mod.includes('PayrunBankReconciliationService')) {
    fail('PayrunsModule must register PayrunBankReconciliationService.');
  }
  if (!bankSvc.includes('GOV_POLICY_KEY_BANK_FEE_TOLERANCE')) {
    fail('PayrunBankReconciliationService must resolve GOV-6B bank fee tolerance via policy key constant.');
  }
  if (!bankSvc.includes('payroll.period_close')) {
    fail('PayrunBankReconciliationService must allow payroll.period_close on bank gate.');
  }
  if (!bankSvc.includes('PAYRUN_BANK_RECON_OVERRIDE')) {
    fail('PayrunBankReconciliationService must audit PAYRUN_BANK_RECON_OVERRIDE.');
  }
  if (!bankSvc.includes('PAYRUN_BANK_GATE_BLOCKED')) {
    fail('PayrunBankReconciliationService must use PAYRUN_BANK_GATE_BLOCKED.');
  }
  if (!bankSvc.includes('post_close_reconciliation_impact_pending')) {
    fail('PayrunBankReconciliationService must expose post_close_reconciliation_impact_pending (GOV-4).');
  }
  if (!controller.includes('assertAllowsMarkPostedBankGate')) {
    fail('PayrunsController must call bank gate before mark posted readiness.');
  }
  if (!controller.includes('bank-confirmation/import')) {
    fail('PayrunsController must expose bank-confirmation import route.');
  }
  if (!controller.includes('bankOverrideFrom')) {
    fail('PayrunsController must define bankOverrideFrom for treasury override headers.');
  }
  if (!seed.includes('payrun:bank_override')) {
    fail('prisma/seed.ts must define payrun:bank_override.');
  }
  if (!mainTs.includes('x-bank-gate-override')) {
    fail('main.ts CORS must allow bank override headers.');
  }
  if (!payrunDetail.includes('BANK_GATED_POST_ACTIONS')) {
    fail('PayrunDetail must define BANK_GATED_POST_ACTIONS for mark-posted alignment.');
  }
  if (!payrunDetail.includes('/bank-reconciliation')) {
    fail('PayrunDetail must call bank-reconciliation API.');
  }
  if (!client.includes('PAYRUN_BANK_GATE_BLOCKED')) {
    fail('payrunBankReconciliationClient must expose PAYRUN_BANK_GATE_BLOCKED.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3B') || !doc.includes('check:payrun-bank-reconciliation-drift')) {
    fail('docs/PAYRUN_BANK_RECONCILIATION.md must document GOV-3B and drift script.');
  }
  if (!beSpec.includes('assertAllowsMarkPostedBankGate')) {
    fail('Backend spec must cover assertAllowsMarkPostedBankGate.');
  }
  if (!feSpec.includes('canProceedMarkPostedWithBankControl')) {
    fail('Frontend spec must cover canProceedMarkPostedWithBankControl.');
  }

  console.log('[check:payrun-bank-reconciliation-drift] OK');
}

main();
