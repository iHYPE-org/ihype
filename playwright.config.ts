import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Mobile Safari only runs locally; CI installs chromium only.
    ...(process.env.CI ? [] : [{ name: 'Mobile Safari', use: { ...devices['iPhone 14'] } }]),
  ],
  webServer: {
    command: 'npm run dev',
    env: {
      ...process.env,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'playwright-local-only-secret-0123456789',
      AUTH_TRUST_HOST: 'true',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'playwright-local-only-secret-0123456789',
    },
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
