import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const runDir = resolve(directory, '../../../test-results/screenshots', runId)
const child = spawn(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.screenshots.mjs'],
  {
    stdio: 'inherit',
    env: { ...process.env, LORO_SCREENSHOT_RUN_DIR: runDir },
  },
)

child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal === null ? 1 : 0)
})
