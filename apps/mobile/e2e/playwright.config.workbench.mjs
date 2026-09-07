/**
 * The developer workbench is not a learner route and deliberately stays outside STATES.
 * Its browser contract therefore has its own small suite, report, and dev server.
 */

import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { isCI, sharedTiming, sharedUse } from './config.shared.mjs'

const port = Number(process.env.LORO_E2E_PORT ?? 8084)

export default defineConfig({
  testDir: './workbench',
  outputDir: '../../../test-results/mobile-workbench-e2e',
  // Font metrics differ by host even with bundled typography. Keep reviewed macOS/Linux
  // baselines separate so a two-pixel height difference does not mask real component drift.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{platform}/{arg}{ext}',
  ...sharedTiming,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../../playwright-report/mobile-workbench', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...sharedUse,
  },
  webServer: {
    command: `pnpm exec expo start --web --port ${port}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/dev/tokens`,
    timeout: 120_000,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { EXPO_NO_TELEMETRY: '1' },
  },
})
