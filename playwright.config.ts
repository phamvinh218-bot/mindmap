import { defineConfig, devices } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

/** E2E runs against `next start` with the in-memory store and throwaway secrets. */
export const E2E_PASSWORD = 'e2e-owner-pass';
const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ALLOW_MEMORY_REPO: '1',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      OWNER_PASSWORD_HASH: 'b64:' + Buffer.from(bcrypt.hashSync(E2E_PASSWORD, 10)).toString('base64url'),
      SESSION_SECRET: randomBytes(36).toString('base64url'),
      CRON_SECRET: 'e2e-cron',
    },
  },
});
