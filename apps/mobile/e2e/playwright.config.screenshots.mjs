import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import { accountEnvironment, sharedUse } from './config.shared.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.LORO_E2E_PORT ?? 8086)
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const runDir =
  process.env.LORO_SCREENSHOT_RUN_DIR ??
  resolve(directory, '../../../test-results/screenshots', runId)

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.capture.ts',
  outputDir: resolve(runDir, 'diagnostics', 'playwright'),
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalTimeout: 16 * 60_000,
  forbidOnly: true,
  globalSetup: resolve(directory, 'screenshots.setup.mjs'),
  reporter: [[resolve(directory, 'screenshots.reporter.mjs'), { runDir }]],
  metadata: { screenshotRunDir: runDir },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...sharedUse,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: `node e2e/screenshots-server.mjs ${port}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 120_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 8_000 },
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...accountEnvironment, EXPO_PUBLIC_PSEUDO_LOCALE: '0' },
  },
})
