/**
 * Recruitment live authz — real login + real API (opt-in).
 *
 * Prereqs:
 *   - API + DB: `npm run db:seed`, demo legal entity (`npm run demo:seed` when allowed), then
 *     `npm run demo:seed:recruitment-users` (creates talent.*@demo.payroll — password admin123).
 *   - Admin portal running (default http://localhost:3001).
 *
 * Run:
 *   RECRUITMENT_LIVE_E2E=1 npx playwright test test/playwright/recruitment-authz-live.spec.ts --project=chromium
 *
 * This file intentionally does not use the mocked API stubs from `recruitment-rbac.spec.ts`.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';
const API_V1 = `${(process.env.E2E_API_ORIGIN ?? 'http://localhost:4000').replace(/\/$/, '')}/v1`;

const DEMO_PASSWORD = 'admin123';

const LIVE_USERS = {
  recruiter: 'talent.recruiter@demo.payroll',
  hiringManager: 'talent.hiring.manager@demo.payroll',
  interviewer: 'talent.interviewer@demo.payroll',
  hrops: 'talent.hrops@demo.payroll',
} as const;

async function loginToAdminPortal(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('admin@company.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30_000 });
}

async function selectDemoLegalEntity(page: Page, selectTestId: string) {
  const sel = page.getByTestId(selectTestId);
  await sel.waitFor({ state: 'visible', timeout: 20_000 });
  await sel.selectOption({ label: /Demo Company/ });
}

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${API_V1}/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.text();
  expect(res.ok(), `login failed for ${email}: ${res.status()} ${body}`).toBeTruthy();
  const j = JSON.parse(body) as { access_token: string };
  expect(j.access_token).toBeTruthy();
  return j.access_token;
}

async function fetchFirstLegalEntityId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${API_V1}/legal-entities?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  expect(res.ok(), body).toBeTruthy();
  const j = JSON.parse(body) as { items?: Array<{ id: string }> };
  const id = j.items?.[0]?.id;
  expect(id, 'No legal entities returned — run demo:seed').toBeTruthy();
  return id as string;
}

test.describe('Live recruitment authz (real login + API)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(() => {
    test.skip(
      process.env.RECRUITMENT_LIVE_E2E !== '1',
      'Set RECRUITMENT_LIVE_E2E=1 and run admin + API; use npm run demo:seed:recruitment-users for talent.*@demo.payroll.',
    );
  });

  test('API: interviewer token cannot create a requisition (403)', async ({ request }) => {
    const token = await apiLogin(request, LIVE_USERS.interviewer, DEMO_PASSWORD);
    const legalEntityId = await fetchFirstLegalEntityId(request, token);
    const res = await request.post(`${API_V1}/api/recruitment/requisitions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { legal_entity_id: legalEntityId, job_title: 'E2E forbidden create' },
    });
    expect(res.status()).toBe(403);
  });

  test('Recruiter: job requisitions page loads and can create a draft requisition', async ({ page }) => {
    await loginToAdminPortal(page, LIVE_USERS.recruiter, DEMO_PASSWORD);
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('requisitions-blocked')).not.toBeVisible();
    await expect(page.getByTestId('job-requisitions-page')).toBeVisible();

    await selectDemoLegalEntity(page, 'requisitions-legal-entity');
    await page.getByTestId('requisitions-create-button').click();
    const title = `Live E2E ${Date.now()}`;
    await page.getByTestId('requisition-form-title').fill(title);
    await page.getByTestId('requisition-form-submit').click();
    await expect(page.getByTestId('requisition-form-modal')).not.toBeVisible({ timeout: 20_000 });
    await expect(page.locator('tr').filter({ hasText: title })).toContainText('Draft', { timeout: 15_000 });
  });

  test('Hiring manager: can approve and post an existing draft (serial data from recruiter flow)', async ({
    page,
    request,
  }) => {
    const recruiterToken = await apiLogin(request, LIVE_USERS.recruiter, DEMO_PASSWORD);
    const legalEntityId = await fetchFirstLegalEntityId(request, recruiterToken);
    const title = `Live HM ${Date.now()}`;
    const createRes = await request.post(`${API_V1}/api/recruitment/requisitions`, {
      headers: { Authorization: `Bearer ${recruiterToken}`, 'Content-Type': 'application/json' },
      data: { legal_entity_id: legalEntityId, job_title: title, department: 'E2E' },
    });
    const createBody = await createRes.text();
    expect(createRes.ok(), createBody).toBeTruthy();

    await loginToAdminPortal(page, LIVE_USERS.hiringManager, DEMO_PASSWORD);
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await selectDemoLegalEntity(page, 'requisitions-legal-entity');

    const row = page.locator('tr').filter({ hasText: title });
    await expect(row).toContainText('Draft', { timeout: 20_000 });
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByTestId('requisition-action-approve').getByRole('button', { name: 'Confirm' }).click();
    await expect(row).toContainText('Approved', { timeout: 15_000 });

    await row.getByRole('button', { name: 'Post' }).click();
    await page.getByTestId('requisition-action-post').getByRole('button', { name: 'Confirm' }).click();
    await expect(row).toContainText('Posted', { timeout: 15_000 });
  });

  test('Interviewer: interviews page without schedule action', async ({ page }) => {
    await loginToAdminPortal(page, LIVE_USERS.interviewer, DEMO_PASSWORD);
    await page.goto(`${BASE_URL}/recruitment/interviews`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Interviews' })).toBeVisible();
    await expect(page.getByTestId('interviews-schedule-button')).not.toBeVisible();
  });

  test('HR Operations: onboarding shell with start workflow action', async ({ page }) => {
    await loginToAdminPortal(page, LIVE_USERS.hrops, DEMO_PASSWORD);
    await page.goto(`${BASE_URL}/recruitment/onboarding`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('onboarding-blocked')).not.toBeVisible();
    await expect(page.getByTestId('onboarding-page')).toBeVisible();
    await expect(page.getByTestId('onboarding-create-button')).toBeVisible();
  });

  test('Interviewer: job requisitions shows access denied', async ({ page }) => {
    await loginToAdminPortal(page, LIVE_USERS.interviewer, DEMO_PASSWORD);
    await page.goto(`${BASE_URL}/recruitment/job-requisitions`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('requisitions-blocked')).toBeVisible();
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
  });
});

