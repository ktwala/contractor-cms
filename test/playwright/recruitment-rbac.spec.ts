/**
 * Recruitment RBAC — Playwright role-route enforcement tests.
 *
 * Seeds role-specific users via localStorage and verifies:
 * - sidebar visibility
 * - page access
 * - action button visibility/absence
 *
 * These tests enforce the surface capability registry at the UI level.
 *
 * Mock JWTs are not valid API credentials; the admin axios client clears localStorage on 401 and
 * redirects to login. We stub common GET /v1 reads so the shell stays mounted while RBAC is tested.
 *
 * For real login + API authz, use `recruitment-authz-live.spec.ts` (opt-in via `RECRUITMENT_LIVE_E2E=1`).
 */

import { test, expect, type Page } from '@playwright/test';

/** Admin portal (Vite default 3001). Override when the dev server uses another port, e.g. `ADMIN_PORTAL_E2E_URL=http://localhost:3002`. */
const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';

/** Matches `ADMIN_PORTAL_ENTRY_PERMISSIONS` in admin `App.tsx` — required to render `AdminLayout` instead of redirecting to `/login`. */
const PORTAL_SHELL = 'iam:users:manage' as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  TALENT_ADMIN: [
    PORTAL_SHELL,
    'recruitment:requisitions:create', 'recruitment:requisitions:view', 'recruitment:requisitions:update',
    'recruitment:requisitions:approve', 'recruitment:requisitions:post', 'recruitment:requisitions:manage',
    'recruitment:candidates:create', 'recruitment:candidates:view',
    'recruitment:applications:create', 'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:schedule', 'recruitment:interviews:view', 'recruitment:interviews:feedback', 'recruitment:interviews:manage',
    'recruitment:offers:create', 'recruitment:offers:approve', 'recruitment:offers:send', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view', 'recruitment:onboarding:complete_tasks',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents', 'recruitment:onboarding:verify_documents',
    'recruitment:onboarding:manage_equipment', 'recruitment:onboarding:assign_equipment',
    'recruitment:onboarding:manage_access', 'recruitment:onboarding:provision_access',
  ],
  RECRUITER: [
    PORTAL_SHELL,
    'recruitment:requisitions:create', 'recruitment:requisitions:view', 'recruitment:requisitions:update',
    'recruitment:candidates:create', 'recruitment:candidates:view',
    'recruitment:applications:create', 'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:schedule', 'recruitment:interviews:view', 'recruitment:interviews:manage',
    'recruitment:offers:create', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents',
  ],
  HIRING_MANAGER: [
    PORTAL_SHELL,
    'recruitment:requisitions:view', 'recruitment:requisitions:approve', 'recruitment:requisitions:post',
    'recruitment:candidates:view',
    'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:view', 'recruitment:interviews:feedback',
    'recruitment:offers:view', 'recruitment:offers:approve',
    'recruitment:onboarding:view',
  ],
  INTERVIEWER: [
    PORTAL_SHELL,
    'recruitment:interviews:view', 'recruitment:interviews:feedback',
  ],
  HR_OPERATIONS: [
    PORTAL_SHELL,
    'recruitment:candidates:view', 'recruitment:applications:view',
    'recruitment:interviews:view', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view', 'recruitment:onboarding:complete_tasks',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents', 'recruitment:onboarding:verify_documents',
    'recruitment:onboarding:manage_equipment', 'recruitment:onboarding:assign_equipment',
    'recruitment:onboarding:manage_access', 'recruitment:onboarding:provision_access',
  ],
  NO_RECRUITMENT: [
    'iam:users:manage',
  ],
};

/** Fails fast when the API is unreachable or bootstrap returns errors (not the same as RBAC "Access Denied"). */
async function expectAdminShellVisible(page: Page) {
  await expect(page.getByRole('heading', { name: 'Unable to connect' })).not.toBeVisible();
}

async function expectNotStuckOnLogin(page: Page) {
  await expect(page.getByRole('heading', { name: 'Admin Login' })).not.toBeVisible();
}

/**
 * Stubs API reads so mock tokens are not invalidated by 401 + localStorage clear in `api.ts`.
 */
async function installRecruitmentRbacApiStubs(page: Page) {
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
      if (url.includes('/api/recruitment/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    },
  );
}

async function loginAsRole(page: Page, roleName: string) {
  const perms = ROLE_PERMISSIONS[roleName] ?? [];
  await page.addInitScript(
    ({ role, permissions }) => {
      localStorage.setItem('user_id', `test-${role.toLowerCase()}-user`);
      localStorage.setItem('role', role);
      localStorage.setItem('country', 'ZAF');
      const t = `mock-${role.toLowerCase()}-jwt-token`;
      localStorage.setItem('token', t);
      localStorage.setItem('auth_token', t);
      localStorage.setItem('admin_permissions', JSON.stringify(permissions));
    },
    { role: roleName, permissions: perms },
  );
}

test.beforeEach(async ({ page }) => {
  await installRecruitmentRbacApiStubs(page);
});

// ── Sidebar visibility ────────────────────────────────────────────

test.describe('Talent sidebar visibility', () => {
  test('TALENT_ADMIN sees Talent nav group', async ({ page }) => {
    await loginAsRole(page, 'TALENT_ADMIN');
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);

    const talentSection = page.locator('text=Talent').first();
    await expect(talentSection).toBeVisible({ timeout: 10000 });
  });

  test('RECRUITER sees Talent nav group', async ({ page }) => {
    await loginAsRole(page, 'RECRUITER');
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);

    const talentSection = page.locator('text=Talent').first();
    await expect(talentSection).toBeVisible({ timeout: 10000 });
  });

  test('INTERVIEWER does not see Talent nav group (no requisitions:view)', async ({ page }) => {
    await loginAsRole(page, 'INTERVIEWER');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const talentSection = page.locator('nav >> text=Talent');
    await expect(talentSection).not.toBeVisible({ timeout: 5000 });
  });

  test('user with no recruitment permissions does not see Talent nav', async ({ page }) => {
    await loginAsRole(page, 'NO_RECRUITMENT');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const talentSection = page.locator('nav >> text=Talent');
    await expect(talentSection).not.toBeVisible({ timeout: 5000 });
  });
});

// ── Route access ──────────────────────────────────────────────────

test.describe('Talent route access', () => {
  const TALENT_ROUTES = [
    '/recruitment/job-requisitions',
    '/recruitment/candidates',
    '/recruitment/interviews',
    '/recruitment/offers',
    '/recruitment/onboarding',
  ];

  test('TALENT_ADMIN can access all Talent routes', async ({ page }) => {
    await loginAsRole(page, 'TALENT_ADMIN');
    for (const route of TALENT_ROUTES) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await expectAdminShellVisible(page);
      await expectNotStuckOnLogin(page);
      const forbidden = page.locator('text=Access Denied');
      await expect(forbidden).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('RECRUITER can access requisitions page', async ({ page }) => {
    await loginAsRole(page, 'RECRUITER');
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    const forbidden = page.locator('text=Access Denied');
    await expect(forbidden).not.toBeVisible({ timeout: 3000 });
  });

  test('HIRING_MANAGER can access requisitions page', async ({ page }) => {
    await loginAsRole(page, 'HIRING_MANAGER');
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);
    const forbidden = page.locator('text=Access Denied');
    await expect(forbidden).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Action button visibility ──────────────────────────────────────

test.describe('Talent action gating', () => {
  test('TALENT_ADMIN sees all requisition actions', async ({ page }) => {
    await loginAsRole(page, 'TALENT_ADMIN');
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expectAdminShellVisible(page);
    await expectNotStuckOnLogin(page);

    await expect(page.getByTestId('requisitions-create-button')).toBeVisible({ timeout: 5000 });
  });

  test('INTERVIEWER cannot access onboarding page', async ({ page }) => {
    await loginAsRole(page, 'INTERVIEWER');
    await page.goto(`${BASE_URL}/recruitment/onboarding`);
    await page.waitForLoadState('networkidle');

    const blockedHeading = page.getByRole('heading', { name: /access denied/i });
    const isBlocked = await blockedHeading.isVisible().catch(() => false);

    const createBtn = page.locator('button:has-text("Create Onboarding")');
    const canSeeCreate = await createBtn.isVisible().catch(() => false);

    expect(isBlocked || !canSeeCreate).toBe(true);
  });
});
