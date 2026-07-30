/**
 * The developer workbench is not a learner route and deliberately stays outside STATES.
 * Its browser contract therefore has its own small suite, report, and dev server.
 */

import { defineConfig } from '@playwright/test'
import { isCI, sharedTiming, sharedUse } from './config.shared.mjs'

const port = 8084

export default defineConfig({
  testDir: './workbench',
  outputDir: '../../../test-results/mobile-workbench-e2e',
  // The deliberately small subset uses bundled production typography and must compare on
  // CI's Linux runner as well as local macOS. Font rasterization can still differ across
  // engines/hosts, so keep this baseline narrow and review cross-platform diffs rather than
  // expanding it into a screenshot of the whole workbench.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
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
