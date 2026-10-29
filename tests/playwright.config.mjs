import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HTTP_GAME_URL = 'http://127.0.0.1:8123/hr-simulator/';
export const FILE_GAME_URL = pathToFileURL(path.join(ROOT, 'hr-simulator', 'index.html')).href;

const engines = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
};

const projects = [];
for (const [name, device] of Object.entries(engines)) {
  projects.push({
    name: `${name}-http`,
    use: { ...device, gameUrl: HTTP_GAME_URL, transport: 'http' },
  });
  projects.push({
    name: `${name}-file`,
    grep: /@parity|@smoke/,
    use: { ...device, gameUrl: FILE_GAME_URL, transport: 'file' },
  });
}

export default defineConfig({
  testDir: path.join(ROOT, 'tests', 'e2e'),
  outputDir: path.join(ROOT, 'tests', 'artifacts', 'test-results'),
  fullyParallel: true,
  retries: 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/serve.mjs',
    cwd: ROOT,
    url: HTTP_GAME_URL.replace('hr-simulator/', 'tests/fixtures/storage-probe/index.html'),
    reuseExistingServer: !process.env.CI,
  },
  projects,
});
