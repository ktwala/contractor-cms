/**
 * PR-RBAC-GOV-3 / PR-RBAC-GOV-3A — Create Payrun readiness override UI vs role + permission:
 * - TENANT_ADMIN: no override panel without payrun:readiness_override
 * - PAYROLL_MANAGER, GLOBAL_PAYROLL_ADMIN: panel when permission present (red readiness)
 * - PLATFORM_SUPERADMIN: admin `useAccess` treats break-glass as full UI permission (documented in RBAC_SPEC)
 *
 * API-mocked (same pattern as statutory-config / tax-table-authoring-rbac).
 * Run: npm run test:playwright:pr-rbac-gov-3
 * Env: ADMIN_PORTAL_E2E_URL (default http://localhost:3001)
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';
const PG_ID = 'pg-gov3-e2e';
const PERIOD_ID = 'per-gov3-e2e';

const RED_READINESS = {
  canCreatePayrun: false,
  readinessPercent: 42,
  blockingReasons: [{ code: 'E2E_NOT_READY', message: 'Blocked for PR-RBAC-GOV-3' }],
};

const PAY_GROUP_ROW = {
  id: PG_ID,
  name: 'Gov3 Pay Group',
  code: 'GOV3',
  country: 'ZA',
  currency: 'ZAR',
  frequency: 'MONTHLY',
  legalEntityId: 'le-e2e',
  legalEntity: { name: 'E2E Legal Entity' },
};

const PERIOD_ROW = {
  id: PERIOD_ID,
  start_date: '2026-01-01',
  end_date: '2026-01-31',
  pay_date: '2026-02-06',
};

const INCLUSION_PREVIEW = {
  pay_group: { id: PG_ID, code: 'GOV3', name: 'Gov3 Pay Group' },
  period: { period_start: '2026-01-01', period_end: '2026-01-31', pay_date: '2026-02-06' },
  run_type: 'REGULAR',
  candidates: [{ employee_id: 'emp-e2e-1', reason: '', employee_no: 'E001', first_name: 'Test', last_name: 'User' }],
  excluded: [],
  employment_scope: {
    active_employees: 1,
    with_employment_in_pay_group: 1,
    with_employment_overlapping_payrun_period: 1,
  },
};

async function stubAuthMe(page: Page, body: Record<string, unknown>) {
  await page.route('**/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function installCreatePayrunShell(page: Page) {
  await page.route(
    (url) => url.toString().includes('/v1/') || url.toString().includes('/api/'),
    async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (url.includes('/bootstrap/status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bootstrap_required: false, user_count: 10 }),
        });
        return;
      }

      if (method === 'GET' && url.includes('/legal-entities')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 'le-e2e', code: 'E2E', name: 'E2E Legal Entity' }],
          }),
        });
        return;
      }

      if (method === 'GET' && url.includes('/dashboard/summary')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ widgets: {} }),
        });
        return;
      }

      if (method === 'GET' && url.includes('/pay-groups') && !url.includes(`/pay-groups/${PG_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [PAY_GROUP_ROW] }),
        });
        return;
      }

      if (method === 'GET' && url.includes(`/pay-groups/${PG_ID}/periods`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [PERIOD_ROW] }),
        });
        return;
      }

      if (method === 'GET' && url.includes(`/payroll/readiness/pay-groups/${PG_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RED_READINESS),
        });
        return;
      }

      if (method === 'POST' && url.includes('/payruns/preview-inclusions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(INCLUSION_PREVIEW),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }

      await route.continue();
    },
  );
}

async function seedLocalStorage(page: Page, role: string, permissions: readonly string[]) {
  await page.addInitScript(
    ({ role, permissions: p }) => {
      const t = `e2e-gov3-${String(role).toLowerCase()}-jwt`;
      localStorage.setItem('user_id', `e2e-gov3-${String(role).toLowerCase()}`);
      localStorage.setItem('role', role);
      localStorage.setItem('token', t);
      localStorage.setItem('auth_token', t);
      localStorage.setItem('admin_permissions', JSON.stringify(p));
    },
    { role, permissions: [...permissions] },
  );
}

async function gotoReviewStepWithRedReadiness(page: Page) {
  await page.goto(`${BASE_URL}/payroll/payruns/new`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Create Payrun', { exact: true })).toBeVisible({ timeout: 20000 });

  await page.getByText('Pay Group *', { exact: true }).locator('..').locator('select').selectOption(PG_ID);
  await expect(page.getByText('Payroll readiness is not green', { exact: false })).toBeVisible({ timeout: 15000 });

  await page.getByText('Payroll Period', { exact: true }).locator('..').locator('select').selectOption(PERIOD_ID);
  await page.getByRole('button', { name: 'Next: Population' }).click();
  await expect(page.getByText('Employee Population', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Next: Review' }).click();
  await expect(page.getByText('Review & Create', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('You cannot create this payrun until payroll readiness is green', { exact: false })).toBeVisible({
    timeout: 15000,
  });
}

test.describe('PR-RBAC-GOV-3 override authority (Create Payrun)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Contract test (run with --project=chromium)');
  });

  test('TENANT_ADMIN with payrun create but without readiness_override does not see audited override panel', async ({
    page,
  }) => {
    const permissions = [
      'payrun:read',
      'payrun:create',
      'pay_group:read',
      'iam:users:manage',
    ] as const;
    await seedLocalStorage(page, 'TENANT_ADMIN', permissions);
    await stubAuthMe(page, {
      user_id: 'e2e-gov3-tenant',
      roles: ['TENANT_ADMIN'],
      permissions: [...permissions],
      legal_entity_access: [],
    });
    await installCreatePayrunShell(page);

    await gotoReviewStepWithRedReadiness(page);

    await expect(page.getByText('Readiness override (audited)', { exact: true })).not.toBeVisible();
  });

  test('PAYROLL_MANAGER with readiness_override sees audited override panel when red', async ({ page }) => {
    const permissions = [
      'payrun:read',
      'payrun:create',
      'pay_group:read',
      'payrun:readiness_override',
    ] as const;
    await seedLocalStorage(page, 'PAYROLL_MANAGER', permissions);
    await stubAuthMe(page, {
      user_id: 'e2e-gov3-mgr',
      roles: ['PAYROLL_MANAGER'],
      permissions: [...permissions],
      legal_entity_access: [],
    });
    await installCreatePayrunShell(page);

    await gotoReviewStepWithRedReadiness(page);

    await expect(page.getByText('Readiness override (audited)', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder(/x-readiness-override-justification/i)).toBeVisible();
  });

  test('GLOBAL_PAYROLL_ADMIN with readiness_override sees audited override panel when red', async ({ page }) => {
    const permissions = [
      'payrun:read',
      'payrun:create',
      'pay_group:read',
      'payrun:readiness_override',
    ] as const;
    await seedLocalStorage(page, 'GLOBAL_PAYROLL_ADMIN', permissions);
    await stubAuthMe(page, {
      user_id: 'e2e-gov3-global-payroll',
      roles: ['GLOBAL_PAYROLL_ADMIN'],
      permissions: [...permissions],
      legal_entity_access: [],
    });
    await installCreatePayrunShell(page);

    await gotoReviewStepWithRedReadiness(page);

    await expect(page.getByText('Readiness override (audited)', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder(/x-readiness-override-justification/i)).toBeVisible();
  });

  test('PLATFORM_SUPERADMIN sees readiness override UI without listing payrun:readiness_override (admin UI break-glass)', async ({
    page,
  }) => {
    const permissions = ['payrun:read', 'payrun:create', 'pay_group:read'] as const;
    await seedLocalStorage(page, 'PLATFORM_SUPERADMIN', permissions);
    await stubAuthMe(page, {
      user_id: 'e2e-gov3-superadmin',
      roles: ['PLATFORM_SUPERADMIN'],
      permissions: [...permissions],
      legal_entity_access: [],
    });
    await installCreatePayrunShell(page);

    await gotoReviewStepWithRedReadiness(page);

    await expect(page.getByText('Readiness override (audited)', { exact: true })).toBeVisible({ timeout: 15000 });
  });
});
