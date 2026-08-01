/**
 * PR-PAYRUN-GOV-3D-LOCK — closed-period temporal governance drift (CI).
 * Run: npm run check:payrun-closed-period-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-closed-period-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const doc = read(path.join(REPO, 'docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md'));
  const guard = read(path.join(REPO, 'src/modules/payruns/payrun-closed-period-mutation-guard.service.ts'));
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const payrunsSvc = read(path.join(REPO, 'src/modules/payruns/payruns.service.ts'));
  const calendar = read(path.join(REPO, 'src/modules/payroll-cycle/services/payroll-calendar.service.ts'));
  const schema = read(path.join(REPO, 'prisma/schema.prisma'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));
  const mainTs = read(path.join(REPO, 'src/main.ts'));
  const perms = read(path.join(REPO, 'src/common/constants/permissions.ts'));
  const spec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-closed-period-mutation-guard.service.spec.ts'));
  const reversalSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-reversal-workflow.service.spec.ts'));
  const correctionSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-correction-approval.service.spec.ts'));
  const reversalSvc = read(path.join(REPO, 'src/modules/payruns/payrun-reversal-workflow.service.ts'));
  const correctionSvc = read(path.join(REPO, 'src/modules/payruns/payrun-correction-approval.service.ts'));
  const payrunDetail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!doc.includes('PR-PAYRUN-GOV-3D-LOCK') || !doc.includes('check:payrun-closed-period-drift')) {
    fail('docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md must document GOV-3D-LOCK and the drift npm script.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3D-2') || !doc.includes('PayrunReversalWorkflow')) {
    fail('docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md must document GOV-3D-2 and PayrunReversalWorkflow.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-3D-2-LOCK')) {
    fail('docs/PAYRUN_CLOSED_PERIOD_GOVERNANCE.md must document PR-PAYRUN-GOV-3D-2-LOCK baseline.');
  }
  if (!guard.includes('PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS')) {
    fail('Guard must audit PAYRUN_CLOSED_PERIOD_MUTATION_BYPASS.');
  }
  if (!guard.includes('PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION')) {
    fail('Guard must audit PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION (GOV-3D-2).');
  }
  if (!guard.includes('CLOSED_PERIOD_MUTATION_BLOCKED')) {
    fail('Guard must throw CLOSED_PERIOD_MUTATION_BLOCKED.');
  }
  if (!guard.includes('PAYRUN_CLOSED_PERIOD_OVERRIDE_PERMISSION')) {
    fail('Guard must define PAYRUN_CLOSED_PERIOD_OVERRIDE_PERMISSION.');
  }
  if (!guard.includes('PAYRUN_CLOSED_PERIOD_JUSTIFICATION_MIN')) {
    fail('Guard must define PAYRUN_CLOSED_PERIOD_JUSTIFICATION_MIN.');
  }
  if (!controller.includes('PayrunClosedPeriodMutationGuardService')) {
    fail('PayrunsController must inject PayrunClosedPeriodMutationGuardService.');
  }
  if (!controller.includes('closedPeriodGuard.assertAllowsPayrunTemporalMutation')) {
    fail('PayrunsController must call closedPeriodGuard.assertAllowsPayrunTemporalMutation for gated routes.');
  }
  if (!controller.includes('closedPeriodHeadersFrom') || !controller.includes('payrunsService.create')) {
    fail('PayrunsController create must forward closedPeriodHeadersFrom into payrunsService.create.');
  }
  if (!controller.includes('reversal-workflows') || !controller.includes('correction-approvals')) {
    fail('PayrunsController must expose GOV-3D-2 reversal-workflows and correction-approvals routes.');
  }
  if (!payrunsSvc.includes('assertAllowsCreateRegularForPeriod')) {
    fail('PayrunsService must call assertAllowsCreateRegularForPeriod on create.');
  }
  if (!payrunsSvc.includes('period_closed')) {
    fail('PayrunsService getLockRules must expose period_closed.');
  }
  if (!calendar.includes('closedAt')) {
    fail('PayrollCalendarService.closePeriod must persist closedAt on pay_periods.');
  }
  if (!schema.includes('closedAt') || !schema.includes('closedByUserId')) {
    fail('Prisma PayPeriod must include closedAt / closedByUserId.');
  }
  if (!schema.includes('model PayrunReversalWorkflow') || !schema.includes('model PayrunCorrectionApproval')) {
    fail('Prisma must define PayrunReversalWorkflow and PayrunCorrectionApproval (GOV-3D-2).');
  }
  if (!seed.includes('payrun:closed_period_override')) {
    fail('prisma/seed.ts must seed payrun:closed_period_override.');
  }
  if (!mainTs.includes('x-closed-period-mutation-bypass')) {
    fail('main.ts CORS must allow closed-period mutation bypass headers.');
  }
  if (!perms.includes('payrun:closed_period_override')) {
    fail('src/common/constants/permissions.ts must define closed period override permission.');
  }
  if (!spec.includes('PayrunClosedPeriodMutationGuardService')) {
    fail('payrun-closed-period-mutation-guard.service.spec.ts must cover the guard.');
  }
  if (!spec.includes('GOV-3D-2')) {
    fail('Guard spec must mention GOV-3D-2 governed path.');
  }
  if (!reversalSpec.includes('GOV-3D-2-LOCK') || !reversalSpec.includes('isApprovedWorkflowForSourceMutation')) {
    fail('payrun-reversal-workflow.service.spec.ts must cover GOV-3D-2-LOCK and pre-link reuse guard.');
  }
  if (!correctionSpec.includes('GOV-3D-2-LOCK') || !correctionSpec.includes('isApprovedCorrectionForSourceMutation')) {
    fail('payrun-correction-approval.service.spec.ts must cover GOV-3D-2-LOCK and pre-link reuse guard.');
  }
  if (!reversalSvc.includes('isApprovedWorkflowForSourceMutation')) {
    fail('PayrunReversalWorkflowService must define isApprovedWorkflowForSourceMutation.');
  }
  if (!reversalSvc.includes('financialControlImpacted')) {
    fail('PayrunReversalWorkflowService.linkReversalPayrun must set GOV-4 source impact flags.');
  }
  if (!correctionSvc.includes('isApprovedCorrectionForSourceMutation')) {
    fail('PayrunCorrectionApprovalService must define isApprovedCorrectionForSourceMutation.');
  }
  if (!correctionSvc.includes('financialControlImpacted')) {
    fail('PayrunCorrectionApprovalService.linkAdjustmentPayrun must set GOV-4 source impact flags.');
  }
  if (!doc.includes('PAYRUN_POST_REVERSAL_IMPACT') || !doc.includes('GOV-4') || !doc.includes('GOV-4-LOCK')) {
    fail('Closed-period doc must cross-link GOV-4 post-reversal impact (PAYRUN_POST_REVERSAL_IMPACT / GOV-4 / GOV-4-LOCK).');
  }
  if (!payrunDetail.includes('period_closed') || !payrunDetail.includes('lock-rules')) {
    fail('PayrunDetail must load lock-rules and branch on period_closed (GOV-3D-LOCK UI parity).');
  }
  if (!pkg.includes('check:payrun-closed-period-drift')) {
    fail('package.json must define check:payrun-closed-period-drift.');
  }
  if (!ci.includes('check:payrun-closed-period-drift')) {
    fail('.github/workflows/ci.yml must run check:payrun-closed-period-drift.');
  }

  console.log('[check:payrun-closed-period-drift] OK');
}

main();
