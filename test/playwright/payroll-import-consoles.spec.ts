/**
 * Payroll supplemental + opening balances import console guardrails (API-mocked).
 * Run focused: npx playwright test test/playwright/payroll-import-consoles.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Admin dev server (local) or vite preview in CI — must match CORS on the API. */
const ADMIN_ORIGIN = process.env.PLAYWRIGHT_ADMIN_ORIGIN || 'http://localhost:3001';
const fixture = (name: string) =>
  path.join(process.cwd(), 'test/playwright/fixtures/payroll', name);

async function adminAuth(page: import('@playwright/test').Page) {
  await page.goto(`${ADMIN_ORIGIN}/login`);
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'mock-payroll-import-e2e');
    localStorage.setItem('token', 'mock-payroll-import-e2e');
    localStorage.setItem('role', 'admin');
    localStorage.setItem('admin_permissions', JSON.stringify(['data_import:write', 'data_import:read', 'employee:read']));
  });
}

test.describe('Payroll import consoles', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Desktop Chrome contract (run full file with --project=chromium)');
  });

  test('supplemental: template download, precheck table, error workbook, upload gated on ready, file clears precheck', async ({
    page,
  }) => {
    const suppBytes = fs.readFileSync(fixture('minimal-supplemental.xlsx'));
    let supplementalPrecheckCalls = 0;

    await page.route('**/v1/payroll/templates/supplemental.xlsx', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: suppBytes,
      });
    });

    await page.route('**/v1/data-imports/payroll-supplemental/precheck', async (route) => {
      supplementalPrecheckCalls += 1;
      const ready = supplementalPrecheckCalls >= 2;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ready,
          summary: { employeesChecked: ready ? 1 : 0, errors: ready ? 0 : 1, warnings: 0 },
          checks: {},
          issues: ready
            ? []
            : [
                {
                  sheet: 'compensation',
                  rowNumber: 2,
                  code: 'TEST_ERROR',
                  severity: 'ERROR',
                  message: 'Precheck issue for grouped table',
                  fieldName: 'employee_no',
                  currentValue: 'X',
                  suggestedFix: 'Fix value',
                  referenceSource: 'contract',
                },
              ],
        }),
      });
    });

    await page.route('**/v1/data-imports/payroll-supplemental/precheck/export-errors**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('PK\x03\x04mock'),
      });
    });

    await adminAuth(page);
    await page.goto(`${ADMIN_ORIGIN}/enterprise/data-imports/payroll-supplemental`);

    const uploadBtn = page.getByRole('button', { name: /Upload & validate on server/ });

    await expect(uploadBtn).toBeDisabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download supplemental template/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

    await page.locator('#supplemental-file-input').setInputFiles(fixture('minimal-supplemental.xlsx'));
    await page.getByRole('button', { name: /^Run precheck$/ }).click();
    await expect(page.getByText('Review issues (grouped)')).toBeVisible();
    await expect(page.locator('th', { hasText: 'Severity' })).toBeVisible();
    await expect(page.getByText('TEST_ERROR')).toBeVisible();
    await expect(uploadBtn).toBeDisabled();

    const [dlErr] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download workbook \(\.xlsx\)/ }).click(),
    ]);
    expect(dlErr.suggestedFilename()).toMatch(/precheck-validation\.xlsx$/i);

    await page.getByRole('button', { name: /^Run precheck$/ }).click();
    await expect(page.getByText('Ready for server upload')).toBeVisible();
    await expect(uploadBtn).toBeEnabled();

    await page.locator('#supplemental-file-input').setInputFiles(fixture('minimal-supplemental.xlsx'));
    await expect(page.getByText('Ready for server upload')).toHaveCount(0);
    await expect(uploadBtn).toBeDisabled();
  });

  test('opening balances: financial totals render; publish disabled until totals review', async ({ page }) => {
    const obBytes = fs.readFileSync(fixture('minimal-opening-balances.xlsx'));

    await page.route('**/v1/payroll/templates/opening-balances.xlsx', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: obBytes,
      });
    });

    await page.route('**/v1/data-imports/payroll-opening-balances/precheck', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ready: true,
          summary: { errors: 0, warnings: 0, totalRows: 1, sheetsDetected: 1 },
          financialControl: {
            countryCode: 'ZA',
            taxYear: 2026,
            asOfDate: null,
            employeeCount: 2,
            ytdGross: 120000,
            ytdTaxable: 100000,
            ytdPaye: 25000,
            ytdNet: 95000,
            alerts: [],
          },
          issues: [],
        }),
      });
    });

    await page.route('**/v1/data-imports/payroll-opening-balances/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          importJobId: 'job-ob-e2e',
          status: 'VALIDATED',
          summary: { sheetsDetected: 1, totalRows: 1, validRows: 1, warningRows: 0, failedRows: 0 },
          structureErrors: [],
        }),
      });
    });

    await page.route('**/v1/data-imports/payroll-opening-balances/job-ob-e2e/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          importJobId: 'job-ob-e2e',
          status: 'READY_TO_IMPORT',
          sections: {
            payrollOpeningBalances: { rows: 1, toInsert: 1, toUpdate: 0, toSkip: 0, failed: 0 },
          },
          totals: { ytdGross: 120000, ytdTaxable: 100000, ytdPaye: 25000, ytdNet: 95000 },
          financialControl: {
            countryCode: 'ZA',
            taxYear: 2026,
            asOfDate: null,
            employeeCount: 2,
            ytdGross: 120000,
            ytdTaxable: 100000,
            ytdPaye: 25000,
            ytdNet: 95000,
            alerts: [],
          },
          warnings: [],
          errors: [],
        }),
      });
    });

    await adminAuth(page);
    await page.goto(`${ADMIN_ORIGIN}/enterprise/data-imports/payroll-opening-balances`);

    const uploadBtn = page.getByRole('button', { name: /Upload & validate on server/ });
    await expect(uploadBtn).toBeDisabled();

    await page.locator('#ob-file-input').setInputFiles(fixture('minimal-opening-balances.xlsx'));
    await page.getByRole('button', { name: /^Run precheck$/ }).click();

    await expect(page.getByText('Financial control (precheck file totals)')).toBeVisible();
    await expect(page.getByText('Total YTD gross')).toBeVisible();
    await expect(page.getByText('Total YTD taxable')).toBeVisible();
    await expect(page.getByText('Total YTD PAYE')).toBeVisible();
    await expect(page.getByText('Total YTD net')).toBeVisible();
    await expect(page.getByText(/120/)).toBeVisible();

    await expect(uploadBtn).toBeEnabled();
    await uploadBtn.click();

    await expect(page.getByText('Financial control (validated import job)')).toBeVisible();

    const publishBtn = page.getByRole('button', { name: /Publish opening balances/ });
    await expect(publishBtn).toBeDisabled();
    await page.locator('label', { hasText: 'I have reviewed the YTD totals' }).locator('input[type="checkbox"]').check();
    await expect(publishBtn).toBeEnabled();
  });
});
