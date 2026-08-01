/**
 * GOV-6C / GOV-7A / GOV-7B / GOV-7B-2 — Governance policy admin page (Playwright, API-mocked).
 *
 * Mock JWTs are not valid API credentials; we stub bootstrap and governance routes so the shell mounts.
 *
 * Run focused: npx playwright test test/playwright/governance-policies-admin.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.ADMIN_PORTAL_E2E_URL ?? 'http://localhost:3001';

/** Portal entry (see `ADMIN_PORTAL_ENTRY_PERMISSIONS` in admin `App.tsx`). */
const PORTAL_ENTRY = 'payrun:read' as const;

type DraftStubRow = {
  id: string;
  policy_key: string;
  scope: string;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  proposed_value: unknown;
  effective_from: string;
  impact_preview_hash: string;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  status: string;
  activation_policy_id: string | null;
  approval_reference: string;
  created_at: string;
  updated_at: string;
};

type RouteStats = {
  governanceDraftPosts: number;
  governanceDirectPosts: number;
  governanceDraftRejectPosts: number;
  governanceDraftCancelPosts: number;
  /** Mutable list returned by GET …/drafts (tests may pre-seed). */
  draftRows: DraftStubRow[];
};

const policyRow = {
  id: 'pol-e2e-1',
  policy_key: 'financial_control.net_variance_threshold',
  scope: 'GLOBAL',
  legal_entity_id: null,
  pay_group_id: null,
  current_value: 0.01,
  effective_from: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  changed_by_user_id: 'e2e-user',
  approval_reference: 'SEED-1',
  superseded_by_policy_id: null,
  created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

function pendingDraftRow(): DraftStubRow {
  const now = new Date().toISOString();
  return {
    id: 'draft-e2e-1',
    policy_key: 'financial_control.net_variance_threshold',
    scope: 'GLOBAL',
    legal_entity_id: null,
    pay_group_id: null,
    proposed_value: 0.02,
    effective_from: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    impact_preview_hash: 'e'.repeat(64),
    requested_by_user_id: 'e2e-requester',
    approved_by_user_id: null,
    approved_at: null,
    status: 'PENDING_APPROVAL',
    activation_policy_id: null,
    approval_reference: 'E2E-APPR-42',
    created_at: now,
    updated_at: now,
  };
}

async function installGov6cApiStubs(page: Page, stats: RouteStats) {
  await page.route(
    (url) => {
      const s = url.toString();
      return s.includes('/v1/') || s.includes('/api/payroll-cycle/governance-policies');
    },
    async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (method !== 'GET' && !url.includes('governance-policies')) {
        await route.continue();
        return;
      }

      if (url.includes('/bootstrap/status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bootstrap_required: false, user_count: 10 }),
        });
        return;
      }

      if (url.includes('/pay-groups')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 'pg-e2e', code: 'PG', name: 'E2E Pay Group', legal_entity_id: 'le-e2e' }],
          }),
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

      if (url.includes('/governance-policies/history')) {
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([policyRow]),
          });
        } else {
          await route.continue();
        }
        return;
      }

      if (url.includes('impact-preview') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            policy_key: 'financial_control.net_variance_threshold',
            scope: 'GLOBAL',
            legal_entity_id: null,
            pay_group_id: null,
            previous_value: 0.01,
            proposed_value: 0.02,
            diff: { type: 'THRESHOLD_CHANGE', direction: 'RELAXED', delta: 0.01 },
            simulation: {
              quality: 'HEURISTIC',
              affected_payruns_checked: 0,
              would_unblock_count: 0,
              would_block_count: 0,
              disclaimer: 'Preview is heuristic and does not replace final gate evaluation.',
            },
            payload_hash: 'e'.repeat(64),
          }),
        });
        return;
      }

      if (url.includes('/governance-policies/drafts') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(stats.draftRows),
        });
        return;
      }

      if (method === 'POST' && /governance-policies\/drafts\/([^/]+)\/approve/.test(url)) {
        const m = url.match(/governance-policies\/drafts\/([^/]+)\/approve/);
        const id = m?.[1] ?? '';
        const row = stats.draftRows.find((r) => r.id === id);
        if (row) {
          row.status = 'APPROVED';
          row.approved_by_user_id = 'e2e-gov-user';
          row.approved_at = new Date().toISOString();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(row ?? { id, status: 'APPROVED' }),
        });
        return;
      }

      if (method === 'POST' && /governance-policies\/drafts\/([^/]+)\/reject/.test(url)) {
        stats.governanceDraftRejectPosts += 1;
        const m = url.match(/governance-policies\/drafts\/([^/]+)\/reject/);
        const id = m?.[1] ?? '';
        const row = stats.draftRows.find((r) => r.id === id);
        if (row) {
          row.status = 'REJECTED';
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(row ?? { id, status: 'REJECTED' }),
        });
        return;
      }

      if (method === 'POST' && /governance-policies\/drafts\/([^/]+)\/cancel/.test(url)) {
        stats.governanceDraftCancelPosts += 1;
        const m = url.match(/governance-policies\/drafts\/([^/]+)\/cancel/);
        const id = m?.[1] ?? '';
        const row = stats.draftRows.find((r) => r.id === id);
        if (row) {
          row.status = 'CANCELLED';
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(row ?? { id, status: 'CANCELLED' }),
        });
        return;
      }

      if (method === 'POST' && /governance-policies\/drafts\/([^/]+)\/activate/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...policyRow,
            id: 'pol-e2e-activated',
            current_value: 0.02,
          }),
        });
        return;
      }

      if (
        method === 'POST' &&
        url.includes('/governance-policies/drafts') &&
        !/\/governance-policies\/drafts\/[^/]+\/(approve|reject|cancel|activate)/.test(url)
      ) {
        stats.governanceDraftPosts += 1;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(pendingDraftRow()),
        });
        return;
      }

      if (url.includes('/governance-policies') && method === 'GET' && !url.includes('history') && !url.includes('drafts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([policyRow]),
        });
        return;
      }

      if (url.includes('/governance-policies') && method === 'POST' && !url.includes('impact-preview') && !url.includes('/drafts')) {
        stats.governanceDirectPosts += 1;
        await route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'GOV_POLICY_DIRECT_CREATE_DEPRECATED',
            message: 'Use drafts (GOV-7B).',
          }),
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

async function seedSession(page: Page, permissions: string[]) {
  const merged = [...new Set([PORTAL_ENTRY, ...permissions])];
  await page.addInitScript((p: string[]) => {
    const t = 'e2e-gov-6c-token';
    localStorage.setItem('token', t);
    localStorage.setItem('auth_token', t);
    localStorage.setItem('role', 'E2E_GOV_OPERATOR');
    localStorage.setItem('admin_permissions', JSON.stringify(p));
    localStorage.setItem('user_id', 'e2e-gov-user');
    localStorage.setItem('country', 'ZAF');
  }, merged);
}

test.describe('GOV-6C / GOV-7B-2 Governance policies admin', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Contract test (run with --project=chromium)');
  });

  test('shows payrun:admin denial when permission missing', async ({ page }) => {
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, []);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('You need payrun:admin')).toBeVisible({ timeout: 15000 });
    expect(stats.governanceDraftPosts).toBe(0);
    expect(stats.governanceDirectPosts).toBe(0);
  });

  test('shows policy admin surface when payrun:admin present', async ({ page }) => {
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, ['payrun:admin']);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Governance policies').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Propose policy change (draft)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run impact preview' })).toBeVisible();
  });

  test('GOV-7A/7B: impact preview then acknowledgement; POST draft (not direct create)', async ({ page }) => {
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, ['payrun:admin']);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Run impact preview' })).toBeVisible({ timeout: 15000 });

    await page.locator('div:has-text("Policy scope")').locator('select').first().selectOption('GLOBAL');
    await expect(page.getByRole('button', { name: 'Run impact preview' })).toBeEnabled();

    await page.getByRole('button', { name: 'Run impact preview' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Payload hash')).toBeVisible();

    await page.getByPlaceholder(/Linear APP/i).fill('E2E-APPR-42');
    const confirm = page.getByRole('button', { name: 'Submit draft for approval' });
    await expect(confirm).toBeDisabled();

    await page.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    expect(stats.governanceDraftPosts).toBe(1);
    expect(stats.governanceDirectPosts).toBe(0);
  });

  test('GOV-7B: approver may approve and activate when distinct from requester', async ({ page }) => {
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [pendingDraftRow()],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, ['payrun:admin']);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Load current policies' }).click();
    await expect(page.getByText('Policy drafts (GOV-7B / GOV-7B-2)')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('button', { name: 'Activate' })).toBeEnabled({ timeout: 10000 });
    await page.getByRole('button', { name: 'Activate' }).click();
    expect(stats.governanceDirectPosts).toBe(0);
  });

  test('GOV-7B-2: non-requester may reject pending draft', async ({ page }) => {
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [pendingDraftRow()],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, ['payrun:admin']);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Load current policies' }).click();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeEnabled({ timeout: 15000 });
    await page.getByRole('button', { name: 'Reject' }).click();
    expect(stats.governanceDraftRejectPosts).toBe(1);
    await expect(page.getByText('Rejected')).toBeVisible();
  });

  test('GOV-7B-2: requester may cancel own pending draft', async ({ page }) => {
    const ownDraft = { ...pendingDraftRow(), requested_by_user_id: 'e2e-gov-user' };
    const stats: RouteStats = {
      governanceDraftPosts: 0,
      governanceDirectPosts: 0,
      governanceDraftRejectPosts: 0,
      governanceDraftCancelPosts: 0,
      draftRows: [ownDraft],
    };
    await installGov6cApiStubs(page, stats);
    await seedSession(page, ['payrun:admin']);
    await page.goto(`${BASE_URL}/payroll/governance-policies`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Load current policies' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled({ timeout: 15000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(stats.governanceDraftCancelPosts).toBe(1);
    await expect(page.getByText('Cancelled')).toBeVisible();
  });
});
