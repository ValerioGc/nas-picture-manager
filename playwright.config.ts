import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'src/tests/e2e/features/**/*.feature',
  steps: 'src/tests/e2e/steps/**/*.ts',
  outputDir: 'src/tests/e2e/.features-gen',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1421',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 1421',
      url: 'http://127.0.0.1:1421',
      env: { NAS_APP_SOCKET: '/tmp/nas-picture-manager-e2e.sock', CHOKIDAR_USEPOLLING: 'true' },
      reuseExistingServer: false,
    },
    {
      command: 'npx nas-base-app backend-dev',
      url: 'http://127.0.0.1:1421/api/status',
      env: { NAS_APP_SOCKET: '/tmp/nas-picture-manager-e2e.sock' },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
