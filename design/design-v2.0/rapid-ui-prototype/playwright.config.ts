import { defineConfig, devices } from '@playwright/test';

// PREVIEW=1 runs the suite against the production build (`vite preview`),
// service worker included; otherwise against the dev server. BROWSER=webkit runs
// it in WebKit, the engine of every browser on iOS (`npx playwright install webkit`);
// BROWSER=firefox in Gecko (Firefox for Android), without mobile emulation, which
// Firefox doesn't support.
const preview = process.env.PREVIEW === '1';
const PORT = preview ? 4180 : 5320;
const browser = process.env.BROWSER === 'webkit' || process.env.BROWSER === 'firefox' ? process.env.BROWSER : 'chromium';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    ...(browser === 'firefox' ? { isMobile: false } : {}),
    browserName: browser,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    serviceWorkers: preview ? 'allow' : 'block',
  },
  webServer: {
    command: preview ? `npx vite build && npx vite preview --port ${PORT} --strictPort` : `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !preview,
    timeout: 120_000,
  },
});
