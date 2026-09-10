import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { accountEnvironment, isCI, sharedTiming, sharedUse } from './config.shared.mjs'

const port = Number(process.env.LORO_E2E_PORT ?? 8082)

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
    // `--clear` on CI so EXPO_PUBLIC_API_URL (account mocks) is not served from a
    // previous Metro cache that inlined an unconfigured API and left Google disabled.
    command: `pnpm exec expo start --web --port ${port}${isCI ? ' --clear' : ''}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: accountEnvironment,
  },
})
