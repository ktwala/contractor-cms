/**
 * PR-TAX-GOV-2C.1 — Statutory Config readiness cards: LS must not imply ZA statutory trio (UIF/SDL/MTC).
 *
 * Stubs admin APIs (same shell pattern as tax-table-authoring-rbac).
 * Run: npx playwright test test/playwright/statutory-config-country-copy.spec.ts --project=chromium
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';

const READINESS_LS = {
  country: 'LS',
  as_of: '2026-05-07',
  pack_registry: { ready: true, rows: [{ id: 'p-ls' }] },
  paye_tax_table: { ready: true, rows: [{ id: 't-ls' }] },
  statutory_configs: { ready: true, expected_types: [] as string[], checks: [] },
  readiness: { snapshot_engine_ready: true, operator_bootstrap_complete: true },
  notes: {},
};

const READINESS_ZA = {
  country: 'ZA',
  as_of: '2026-05-07',
  pack_registry: { ready: true, rows: [{ id: 'p-za' }] },
  paye_tax_table: { ready: true, rows: [{ id: 't-za' }] },
  statutory_configs: {
    ready: true,
    expected_types: ['UIF', 'SDL', 'MTC'],
    checks: [
      { configType: 'UIF', ready: true, id: '1' },
      { configType: 'SDL', ready: true, id: '2' },
      { configType: 'MTC', ready: true, id: '3' },
    ],
  },
  readiness: { snapshot_engine_ready: true, operator_bootstrap_complete: true },
  notes: {},
};

async function expectAdminShellVisible(page: Page) {
  await expect(page.getByRole('heading', { name: 'Unable to connect' })).not.toBeVisible();
}

async function expectNotStuckOnLogin(page: Page) {
  await expect(page.getByRole('heading', { name: 'Admin Login' })).not.toBeVisible();
}

async function installStatutoryConfigShellStubs(page: Page) {
  await page.route(
    (url) => {
      const s = url.toString();
      return s.includes('/v1/') && !s.includes('/v1/auth/');
    },
    async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = req.url();
      if (url.includes('/bootstrap/status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bootstrap_required: false, user_count: 10 }),
        });
        return;
      }
      if (url.includes('/legal-entities')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 'le-e2e', code: 'E2E', name: 'E2E Legal Entity' }],
          }),
        });
        return;
      }
      if (url.includes('/dashboard/summary')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ widgets: {} }),
        });
        return;
      }
      if (url.includes('/admin/statutory-readiness/LS')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: READINESS_LS }),
        });
        return;
      }
      if (url.includes('/admin/statutory-readiness/ZA')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: READINESS_ZA }),
        });
        return;
      }
      if (url.includes('/admin/tax-tables/statutory-configs/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      if (url.includes('/admin/tax-tables') && !url.includes('statutory-configs')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    },
  );
}

async function stubAuthMe(page: Page, body: Record<string, unknown>) {
  await page.route('**/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function seedLocalSession(page: Page, role: string, permissions: readonly string[]) {
  await page.addInitScript(
    ({ role, permissions }) => {
      localStorage.setItem('user_id', `e2e-${String(role).toLowerCase()}`);
      localStorage.setItem('role', role);
      const t = `mock-${String(role).toLowerCase()}-jwt`;
      localStorage.setItem('token', t);
      localStorage.setItem('auth_token', t);
      localStorage.setItem('admin_permissions', JSON.stringify(permissions));
    },
    { role, permissions: [...permissions] },
  );
}

test.beforeEach(async ({ page }) => {
  await installStatutoryConfigShellStubs(page);
});

test.describe('Statutory Config country copy (2C.1)', () => {
  test('LS readiness panel does not contain ZA statutory trio labels', async ({ page }) => {
    const me = {
      user_id: 'e2e-tax-read',
      roles: ['TENANT_ADMIN'],
      permissions: ['payrun:read', 'tax:read'],
      legal_entity_access: [],
    };
    await stubAuthMe(page, me);
    await seedLocalSession(page, 'TENANT_ADMIN', me.permissions);
    await page.goto(`${BASE_URL}/admin/statutory-config`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    await expect(page.getByText('Statutory Configuration', { exact: true })).toBeVisible({
      timeout: 15000,
    });

    const ls = page.getByTestId('statutory-readiness-ls');
    await expect(ls).toBeVisible();
    await expect(ls).not.toContainText('UIF');
    await expect(ls).not.toContainText('SDL');
    await expect(ls).not.toContainText('MTC');
    await expect(ls).toContainText('Operator bootstrap (LS):');

    const za = page.getByTestId('statutory-readiness-za');
    await expect(za).toBeVisible();
    await expect(za).toContainText('UIF');
    await expect(za).toContainText('Operator bootstrap (ZA):');
  });
});
