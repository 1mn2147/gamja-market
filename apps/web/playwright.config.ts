import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'corepack pnpm --filter @gamja/api dev',
      url: 'http://127.0.0.1:4000/api/v1/healthz',
      reuseExistingServer: !process.env.CI,
      env: { NODE_ENV: 'test', COOKIE_SECURE: 'false', TOSS_SANDBOX_MODE: 'true', WEB_ORIGIN: 'http://127.0.0.1:3000' },
    },
    {
      command: 'corepack pnpm dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      env: { NEXT_PUBLIC_API_ORIGIN: 'http://127.0.0.1:4000', NEXT_PUBLIC_PAYMENT_SANDBOX_MODE: 'true' },
    },
  ],
});
