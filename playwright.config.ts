/**
 * Playwright Configuration for Frontend E2E Tests
 * Tests the employee and admin portals
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // webServer disabled - servers should be started manually
  // webServer: [
  //   {
  //     command: 'cd employee-portal && npm run dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: true,
  //     timeout: 120 * 1000,
  //   },
  // ],
});
