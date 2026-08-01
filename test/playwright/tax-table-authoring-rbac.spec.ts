/**
 * PR-TAX-GOV-2A — Tax Table Authoring RBAC (Playwright, stubbed API).
 *
 * Stubs GET /v1/* (except auth) + GET /v1/auth/me so mock JWTs are not cleared by axios 401 handling.
 * Verifies UI gates driven by localStorage admin_permissions stay aligned after AdminLayout session refresh.
 *
 * Run: npm run test:playwright:tta-rbac
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';

const PORTAL_ENTRY = 'payrun:read' as const;

const TTA_FULL = [
  PORTAL_ENTRY,
  'tax_table_authoring_view',
  'tax_table_authoring_create',
  'tax_table_authoring_import',
  'tax_table_authoring_edit',
  'tax_table_authoring_submit_approval',
  'tax_table_authoring_approve',
  'tax_table_authoring_publish',
  'tax_table_authoring_archive',
  'tax_table_authoring_audit_view',
] as const;

async function expectAdminShellVisible(page: Page) {
  await expect(page.getByRole('heading', { name: 'Unable to connect' })).not.toBeVisible();
}

async function expectNotStuckOnLogin(page: Page) {
  await expect(page.getByRole('heading', { name: 'Admin Login' })).not.toBeVisible();
}

/** Generic admin shell reads — excludes /v1/auth/ so /auth/me can be stubbed per test. */
async function installTaxGov2aShellStubs(page: Page) {
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
      if (url.includes('/tax-table-authoring')) {
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
  await installTaxGov2aShellStubs(page);
});

test.describe('Tax Table Authoring RBAC', () => {
  test('TENANT_ADMIN with full TTA sees Create Tax Table', async ({ page }) => {
    const perms = [...TTA_FULL];
    const me = {
      user_id: 'e2e-tenant-admin',
      roles: ['TENANT_ADMIN'],
      permissions: perms,
      legal_entity_access: [],
    };
    await stubAuthMe(page, me);
    await seedLocalSession(page, 'TENANT_ADMIN', perms);
    await page.goto(`${BASE_URL}/admin/payroll/tax-tables`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    await expect(page.getByText('Tax Table Authoring', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('tta-create-tax-table')).toBeVisible();
  });

  test('TAX_TABLE_ADMINISTRATOR with full TTA sees Create Tax Table', async ({ page }) => {
    const perms = ['audit:events:read', ...TTA_FULL.filter((p) => p !== PORTAL_ENTRY)];
    const me = {
      user_id: 'e2e-tta-admin',
      roles: ['TAX_TABLE_ADMINISTRATOR'],
      permissions: perms,
      legal_entity_access: [],
    };
    await stubAuthMe(page, me);
    await seedLocalSession(page, 'TAX_TABLE_ADMINISTRATOR', perms);
    await page.goto(`${BASE_URL}/admin/payroll/tax-tables`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    await expect(page.getByTestId('tta-create-tax-table')).toBeVisible();
  });

  test('PAYROLL_CLERK without TTA does not see Create Tax Table', async ({ page }) => {
    const perms = [
      PORTAL_ENTRY,
      'payrun:create',
      'payrun:edit',
      'employee:read',
      'employment:read',
      'compensation:read',
      'bank_account:read',
      'tax_profile:read',
    ];
    const me = {
      user_id: 'e2e-clerk',
      roles: ['PAYROLL_CLERK'],
      permissions: perms,
      legal_entity_access: [],
    };
    await stubAuthMe(page, me);
    await seedLocalSession(page, 'PAYROLL_CLERK', perms);
    await page.goto(`${BASE_URL}/admin/payroll/tax-tables`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    await expect(page.getByTestId('tta-create-tax-table')).not.toBeVisible();
  });

  test('SARS_OFFICER (reporting) does not see Create Tax Table', async ({ page }) => {
    const perms = [
      'sars:irp5:read',
      'sars:irp5:generate',
      'sars:irp5:export',
      'sars:emp201:read',
      'sars:emp501:read',
      'tax_profile:read',
    ];
    const me = {
      user_id: 'e2e-sars',
      roles: ['SARS_OFFICER'],
      permissions: perms,
      legal_entity_access: [],
    };
    await stubAuthMe(page, me);
    await seedLocalSession(page, 'SARS_OFFICER', perms);
    await page.goto(`${BASE_URL}/admin/payroll/tax-tables`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    await expect(page.getByTestId('tta-create-tax-table')).not.toBeVisible();
  });
});
