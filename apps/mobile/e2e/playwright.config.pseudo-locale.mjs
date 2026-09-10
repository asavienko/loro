import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { accountEnvironment, isCI, sharedTiming, sharedUse } from './config.shared.mjs'

// Playwright workers read this opt-in at module load; webServer.env alone reaches only Expo.
process.env.EXPO_PUBLIC_PSEUDO_LOCALE = '1'
const port = Number(process.env.LORO_E2E_PORT ?? 8085)

/** A separate server keeps pseudo-locale labels out of the ordinary English locator suite. */
export default defineConfig({
  testDir: '.',
  testMatch: 'pseudo-locale.spec.ts',
  outputDir: '../../../test-results/mobile-pseudo-locale-e2e',
  ...sharedTiming,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../../playwright-report/mobile-pseudo-locale', open: 'never' }],
  ],
  use: { baseURL: `http://127.0.0.1:${port}`, ...sharedUse },
  webServer: {
    command: `pnpm exec expo start --web --port ${port}${isCI ? ' --clear' : ''}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...accountEnvironment, EXPO_PUBLIC_PSEUDO_LOCALE: '1' },
  },
})
