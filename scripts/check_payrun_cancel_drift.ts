/**
 * PR-PAYRUN-CANCEL-1 — governed payrun cancellation contract drift (CI).
 * Run: npm run check:payrun-cancel-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-cancel-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const enums = read(path.join(REPO, 'src/common/dto/enums.dto.ts'));
  const lifecycle = read(path.join(REPO, 'src/modules/payruns/payrun-lifecycle.service.ts'));
  const controller = read(path.join(REPO, 'src/modules/payruns/payruns.controller.ts'));
  const perms = read(path.join(REPO, 'src/common/constants/permissions.ts'));
  const adminPerms = read(path.join(REPO, 'admin-portal/src/constants/permissions.ts'));
  const seed = read(path.join(REPO, 'prisma/seed.ts'));
  const detail = read(path.join(REPO, 'admin-portal/src/pages/PayrunDetail.tsx'));
  const client = read(path.join(REPO, 'admin-portal/src/utils/payrunCancelClient.ts'));
  const spec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-cancel.service.spec.ts'));
  const uiSpec = read(path.join(REPO, 'test/playwright/payrun-cancel-ui.spec.ts'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_CANCEL.md'));

  if (!enums.includes('[PayRunStatus.CANCELLED]: []')) {
    fail('PAYRUN_STATE_TRANSITIONS must keep CANCELLED terminal (empty next states).');
  }
  if (!enums.includes('[PayRunStatus.CALCULATED]: [PayRunStatus.IN_REVIEW, PayRunStatus.CALCULATING, PayRunStatus.DRAFT, PayRunStatus.CANCELLED]')) {
    fail('CALCULATED must allow transition to CANCELLED.');
  }
  if (!enums.includes('[PayRunStatus.IN_REVIEW]: [PayRunStatus.APPROVED, PayRunStatus.DRAFT, PayRunStatus.CANCELLED]')) {
    fail('IN_REVIEW must allow transition to CANCELLED.');
  }
  if (!lifecycle.includes('cancelPayrun(')) {
    fail('PayrunLifecycleService must implement cancelPayrun.');
  }
  if (!lifecycle.includes('PAYRUN_CANCELLED')) {
    fail('cancelPayrun must audit PAYRUN_CANCELLED.');
  }
  if (!lifecycle.includes('PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH')) {
    fail('cancelPayrun must block when payment batch / export exists.');
  }

  if (!controller.includes(":payrun_id/cancel'") && !controller.includes(':payrun_id/cancel')) {
    fail('PayrunsController must expose POST :payrun_id/cancel.');
  }
  if (!controller.includes('payrun:cancel')) {
    fail('cancel route must require payrun:cancel permission.');
  }
  if (!controller.includes('payrun.cancel')) {
    fail('cancel route must invoke closed-period guard with payrun.cancel operation.');
  }

  if (!perms.includes("PAYRUN_CANCEL: 'payrun:cancel'")) {
    fail('Backend permissions must define PAYRUN_CANCEL / payrun:cancel.');
  }
  if (!adminPerms.includes("PAYRUN_CANCEL: 'payrun:cancel'")) {
    fail('admin-portal constants must define PAYRUN_CANCEL / payrun:cancel.');
  }
  if (!seed.includes("'payrun:cancel'")) {
    fail('prisma/seed.ts must seed payrun:cancel permission and assign it to roles.');
  }

  if (!detail.includes('Cancel payrun')) {
    fail('PayrunDetail must expose Cancel payrun UI.');
  }
  if (!detail.includes('/cancel')) {
    fail('PayrunDetail must POST /payruns/:id/cancel.');
  }
  if (!detail.includes('cancelReason')) {
    fail('PayrunDetail must collect cancel reason before confirm.');
  }

  if (!client.includes('PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH')) {
    fail('payrunCancelClient must expose PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH.');
  }

  if (!spec.includes('cancelPayrun')) {
    fail('payrun-cancel.service.spec.ts must exercise cancelPayrun.');
  }
  if (!uiSpec.includes('Cancel payrun')) {
    fail('test/playwright/payrun-cancel-ui.spec.ts must assert Cancel payrun UI.');
  }

  if (!doc.includes('PR-PAYRUN-CANCEL-1') || !doc.includes('check:payrun-cancel-drift')) {
    fail('docs/PAYRUN_CANCEL.md must document PR-PAYRUN-CANCEL-1 and the drift script.');
  }

  console.log('[check:payrun-cancel-drift] OK');
}

main();
