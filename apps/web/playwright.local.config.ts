import { defineConfig, devices } from '@playwright/test';

// Clerk keys for the signed-in workspace tests (dev instance, gitignored file).
process.loadEnvFile?.('.env.local');
process.env.CLERK_PUBLISHABLE_KEY ||= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Full local test against `pnpm dev` (web :3100, API :4100) with the real
 * database, Qloo, Gemini and Ticketmaster. Not run in CI. Seed first: `pnpm seed:demo`.
 */
export default defineConfig({
  testDir: './e2e-local',
  globalSetup: './e2e-local/global-setup.ts',
  timeout: 240_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
