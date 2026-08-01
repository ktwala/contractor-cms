/**
 * PR-PAYRUN-CANCEL-1 — Cancel payrun control visible on Payrun detail (Playwright, API-mocked).
 *
 * Run: npx playwright test test/playwright/payrun-cancel-ui.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';
const PAYRUN_ID = 'pr-cancel-ui-e2e';

async function installPayrunDetailStubs(page: Page) {
  await page.route(
    (url) => url.includes('/v1/') || url.includes('/api/'),
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

      if (method === 'GET' && url.match(new RegExp(`/v1/payruns/${PAYRUN_ID}($|[?])`))) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PAYRUN_ID,
            status: 'DRAFT',
            pay_group_id: 'pg-stub',
            payGroupId: 'pg-stub',
            period_start: '2026-01-01',
            period_end: '2026-01-31',
            pay_date: '2026-02-06',
            payrun_type: 'REGULAR',
            created_at: new Date().toISOString(),
          }),
        });
        return;
      }

      if (method === 'GET' && url.includes(`/v1/payruns/${PAYRUN_ID}/`)) {
        const empty = {
          payrun_id: PAYRUN_ID,
          employee_count: 0,
          register_employee_count: 0,
          totals: { gross: 0, taxable_income: 0, paye: 0, deductions: 0, net: 0 },
          exceptions: {
            openTotal: 0,
            criticalOpen: 0,
            highOpen: 0,
            mediumOpen: 0,
            lowOpen: 0,
            blockingSubmissionCount: 0,
            blockingPaymentCount: 0,
          },
          readiness: {
            approvalReady: false,
            paymentReady: false,
            hasSubmissionBlockers: false,
            hasPaymentBlockers: false,
          },
        };
        if (url.includes('/lock-rules')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ period_closed: false, rules: {} }),
          });
          return;
        }
        if (url.includes('/summary')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(empty) });
          return;
        }
        if (url.includes('/exceptions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [], summary: null }),
          });
          return;
        }
        if (url.includes('/payroll/results/') || url.includes('/results')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ employee_results: [], display_schema: null, totals: null, statutory_totals: [], currency: 'ZAR' }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
        return;
      }

      if (method === 'GET' && url.includes('/v1/pay-groups')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 'pg-stub', code: 'STUB', name: 'Stub pay group', country: 'ZA', currency: 'ZAR' }],
          }),
        });
        return;
      }

      if (method === 'GET' && url.includes('/v1/payroll/readiness/pay-groups/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ canCreatePayrun: true, readinessPercent: 100, blockingReasons: [] }),
        });
        return;
      }

      await route.continue();
    },
  );
}

test.describe('Payrun cancel UI', () => {
  test('shows Cancel payrun when payrun:cancel is granted and status is DRAFT', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('auth_token', 'e2e-token');
      localStorage.setItem('role', 'PAYROLL_CLERK');
      localStorage.setItem('admin_permissions', JSON.stringify(['payrun:read', 'payrun:cancel']));
    });
    await installPayrunDetailStubs(page);
    await page.goto(`${BASE_URL}/payroll/payruns/${PAYRUN_ID}`);
    await expect(page.getByRole('button', { name: 'Cancel payrun' })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Cancel payrun' }).click();
    await expect(page.getByRole('heading', { name: 'Cancel payrun' })).toBeVisible();
    await expect(page.getByPlaceholder('Reason for cancellation (required)…')).toBeVisible();
  });
});
