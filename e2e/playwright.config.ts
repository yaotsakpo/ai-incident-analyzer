import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @incident-analyzer/api dev',
      port: 3000,
      reuseExistingServer: true,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @incident-analyzer/dashboard dev',
      port: 5173,
      reuseExistingServer: true,
      cwd: '..',
    },
  ],
});
