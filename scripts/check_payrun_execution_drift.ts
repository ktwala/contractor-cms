/**
 * Payrun execution / readiness-gate contract drift checks (CI).
 * Run: npm run check:payrun-execution-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-execution-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const gateSvc = read(path.join(REPO, 'src/modules/payruns/payrun-readiness-gate.service.ts'));
  const mod = read(path.join(REPO, 'src/modules/payruns/payruns.module.ts'));
  const mainTs = read(path.join(REPO, 'src/main.ts'));
  const createPayrun = read(path.join(REPO, 'admin-portal/src/pages/CreatePayrun.tsx'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const client = read(path.join(REPO, 'admin-portal/src/utils/payrunExecutionClient.ts'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));

  if (!mod.includes('PayrollReadinessModule')) {
    fail('PayrunsModule must import PayrollReadinessModule for readiness-gated execution.');
  }
  if (!mod.includes('PayrunReadinessGateService')) {
    fail('PayrunsModule must register PayrunReadinessGateService.');
  }
  if (!gateSvc.includes('PAYROLL_READINESS_GATE_BLOCKED')) {
    fail('PayrunReadinessGateService must throw PAYROLL_READINESS_GATE_BLOCKED when blocked.');
  }
  if (!gateSvc.includes('PAYRUN_READINESS_GATE_OVERRIDE')) {
    fail('PayrunReadinessGateService must audit PAYRUN_READINESS_GATE_OVERRIDE on successful override.');
  }

  const requiredOps = [
    'payrun.create',
    'payrun.snapshot',
    'payrun.calculate',
    'payrun.submit_for_approval',
    'payrun.approve',
    'payrun.mark_paid',
    'payrun.mark_posted',
    'payrun.finalize',
    'payrun.create_adjustment',
  ];
  for (const op of requiredOps) {
    if (!controller.includes(`'${op}'`) && !controller.includes(`"${op}"`)) {
      fail(`PayrunsController must invoke readiness gate with operation ${op}.`);
    }
  }

  if (!mainTs.includes('x-readiness-gate-override') || !mainTs.includes('x-readiness-override-justification')) {
    fail('main.ts CORS allowedHeaders must include readiness override headers.');
  }

  if (!seed.includes('payrun:readiness_override')) {
    fail('prisma/seed.ts must define payrun:readiness_override permission.');
  }

  if (!createPayrun.includes('/payroll/readiness/pay-groups/')) {
    fail('CreatePayrun must fetch payroll readiness for the selected pay group.');
  }
  if (!createPayrun.includes('canCreatePayrun')) {
    fail('CreatePayrun must reference canCreatePayrun for create gating.');
  }
  if (!createPayrun.includes('readinessOverrideRequestHeaders')) {
    fail('CreatePayrun must call readinessOverrideRequestHeaders when applying an override.');
  }

  if (!payrunDetail.includes('/payroll/readiness/pay-groups/')) {
    fail('PayrunDetail must fetch payroll readiness for the payrun pay group.');
  }
  if (!payrunDetail.includes('READINESS_GATED_ACTIONS')) {
    fail('PayrunDetail must define READINESS_GATED_ACTIONS for client-side guard alignment.');
  }

  if (!client.includes('PAYROLL_READINESS_GATE_BLOCKED')) {
    fail('payrunExecutionClient must expose PAYROLL_READINESS_GATE_BLOCKED detection.');
  }

  const doc = read(path.join(REPO, 'docs/PAYRUN_EXECUTION.md'));
  if (!doc.includes('PR-PAYRUN-GOV-1') || !doc.includes('check:payrun-execution-drift')) {
    fail('docs/PAYRUN_EXECUTION.md must document PR-PAYRUN-GOV-1 and the drift script.');
  }

  console.log('[check:payrun-execution-drift] OK');
}

main();
