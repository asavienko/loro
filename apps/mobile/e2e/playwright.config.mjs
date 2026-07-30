import { defineConfig } from '@playwright/test'
import { isCI, sharedTiming, sharedUse } from './config.shared.mjs'

const port = 8082

export default defineConfig({
  testDir: '.',
  testIgnore: ['production-unavailable.spec.ts', 'workbench/**'],
  outputDir: '../../../test-results/mobile-e2e',
  ...sharedTiming,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../../playwright-report/mobile', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...sharedUse,
  },
  webServer: {
    command: `pnpm exec expo start --web --port ${port}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { EXPO_NO_TELEMETRY: '1' },
  },
})
