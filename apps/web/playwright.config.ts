import { defineConfig, devices } from '@playwright/test';

const WEB = 'http://localhost:3100';
const API = 'http://localhost:4100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: WEB, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Production builds of both apps; DEMO_MODE keeps Qloo out of E2E runs.
  webServer: [
    {
      command: 'pnpm --filter @housefull/api start',
      url: `${API}/health`,
      env: { PORT: '4100', DEMO_MODE: 'true', WEB_PUBLIC_URL: WEB },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec next start --port 3100',
      url: WEB,
      env: { NEXT_PUBLIC_API_BASE_URL: API },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
