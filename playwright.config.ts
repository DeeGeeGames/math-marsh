import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
