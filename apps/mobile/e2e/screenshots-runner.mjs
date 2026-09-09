import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import {
  ensureRunDirectory,
  failedManifest,
  finalizeManifest,
  formatSummary,
  initialManifest,
  readManifest,
  writeManifest,
} from './screenshots-artifacts.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const repository = resolve(directory, '../../..')
const app = resolve(directory, '..')
const playwrightCli = resolve(dirname(require.resolve('playwright')), 'cli.js')
const port = Number(process.env.LORO_E2E_PORT ?? 8086)
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const runDir = resolve(directory, '../../../test-results/screenshots', runId)
const STOP_TIMEOUT_MS = 8_000

let manifest
let child
let stopping = false
let forwardedSignal
let finished = false
let stopTimer

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

async function main() {
  ensureRunDirectory(runDir)
  try {
    manifest = initialManifest(repository)
    writeManifest(runDir, manifest)
  } catch (error) {
    manifest = failedManifest(error instanceof Error ? error.message : String(error))
    finalizeManifest(runDir, manifest)
    console.error(formatSummary(runDir, manifest))
    process.exitCode = 1
    return
  }

  if (stopping) {
    finish(null, forwardedSignal)
    return
  }

  try {
    await assertPortAvailable(port)
  } catch (error) {
    manifest = failedManifest(error instanceof Error ? error.message : String(error), manifest)
    finalizeManifest(runDir, manifest)
    console.error(formatSummary(runDir, manifest))
    process.exitCode = 1
    return
  }

  if (stopping) {
    finish(null, forwardedSignal)
    return
  }

  child = spawn(
    process.execPath,
    [playwrightCli, 'test', '--config', 'e2e/playwright.config.screenshots.mjs'],
    {
      cwd: app,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: { ...process.env, LORO_SCREENSHOT_RUN_DIR: runDir },
    },
  )
  child.once('error', (error) => finish(1, null, error))
  child.once('exit', finish)
}

await main()

function stop(signal) {
  if (stopping || finished) return
  stopping = true
  forwardedSignal = signal
  if (child === undefined) return
  signalProcessGroup(child, signal)
  stopTimer = setTimeout(() => {
    if (!finished) signalProcessGroup(child, 'SIGKILL')
  }, STOP_TIMEOUT_MS)
}

function finish(code, signal, error) {
  if (finished) return
  finished = true
  if (stopTimer !== undefined) clearTimeout(stopTimer)
  let exitCode = code ?? (forwardedSignal === 'SIGINT' || signal === 'SIGINT' ? 130 : 1)
  try {
    const finalManifest = readManifest(runDir)
    if (finalManifest.status === 'running') {
      const detail = error?.message ?? `Playwright exited with ${signal ?? `code ${code}`}.`
      const failed = failedManifest(`The screen capture did not finalize: ${detail}`, finalManifest)
      finalizeManifest(runDir, failed)
      console.error(formatSummary(runDir, failed))
    }
    if (finalManifest.status !== 'passed' && exitCode === 0) exitCode = 1
  } catch (manifestError) {
    const failed = failedManifest(
      `The screen capture manifest could not be finalized: ${manifestError instanceof Error ? manifestError.message : String(manifestError)}`,
      manifest,
    )
    finalizeManifest(runDir, failed)
    console.error(formatSummary(runDir, failed))
    exitCode = exitCode === 0 ? 1 : exitCode
  }
  process.exitCode = exitCode
}

function assertPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    return Promise.reject(
      new Error(`LORO_E2E_PORT must be an integer from 1 to 65535; received ${port}.`),
    )
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE')
        reject(new Error(`Port ${port} is already in use. Set LORO_E2E_PORT to an unused port.`))
      else reject(error)
    })
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => (error === undefined ? resolve() : reject(error)))
    })
  })
}

function signalProcessGroup(child, signal) {
  if (child.pid === undefined) return
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // The child may have exited between the status check and the signal delivery.
    }
  }
  child.kill(signal)
}
