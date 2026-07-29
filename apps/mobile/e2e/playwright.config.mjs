import { defineConfig } from '@playwright/test'
import process from 'node:process'

const port = 8082

export default defineConfig({
  testDir: '.',
  outputDir: '../../../test-results/mobile-e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 2,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../../playwright-report/mobile', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec expo start --web --port ${port}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 120_000,
    reuseExistingServer: process.env.CI === undefined,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { EXPO_NO_TELEMETRY: '1' },
  },
})
