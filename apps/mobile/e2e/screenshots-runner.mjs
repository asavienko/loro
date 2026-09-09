import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureRunDirectory,
  failedManifest,
  initialManifest,
  readManifest,
  writeGallery,
  writeManifest,
} from './screenshots-artifacts.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(directory, '../../..')
const port = Number(process.env.LORO_E2E_PORT ?? 8086)
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const runDir = resolve(directory, '../../../test-results/screenshots', runId)

async function main() {
  ensureRunDirectory(runDir)
  let manifest
  try {
    manifest = initialManifest(repository)
    writeManifest(runDir, manifest)
  } catch (error) {
    manifest = failedManifest(error instanceof Error ? error.message : String(error))
    writeManifest(runDir, manifest)
    writeGallery(runDir, manifest)
    console.error(
      `Screen image setup failed: ${manifest.error}\nGallery: ${resolve(runDir, 'index.html')}`,
    )
    process.exitCode = 1
    return
  }

  try {
    await assertPortAvailable(port)
  } catch (error) {
    manifest = failedManifest(error instanceof Error ? error.message : String(error), manifest)
    writeManifest(runDir, manifest)
    writeGallery(runDir, manifest)
    console.error(
      `Screen image setup failed: ${manifest.error}\nGallery: ${resolve(runDir, 'index.html')}`,
    )
    process.exitCode = 1
    return
  }

  const child = spawn(
    'pnpm',
    ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.screenshots.mjs'],
    {
      stdio: 'inherit',
      env: { ...process.env, LORO_SCREENSHOT_RUN_DIR: runDir },
    },
  )
  let stopping = false
  let forwardedSignal
  let finished = false
  const stop = (signal) => {
    if (stopping) return
    stopping = true
    forwardedSignal = signal
    child.kill(signal)
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))
  const finish = (code, signal, error) => {
    if (finished) return
    finished = true
    let exitCode = code ?? (forwardedSignal === 'SIGINT' || signal === 'SIGINT' ? 130 : 1)
    try {
      const finalManifest = readManifest(runDir)
      if (finalManifest.status === 'running') {
        const detail = error?.message ?? `Playwright exited with ${signal ?? `code ${code}`}.`
        const failed = failedManifest(
          `The screen capture did not finalize: ${detail}`,
          finalManifest,
        )
        writeManifest(runDir, failed)
        writeGallery(runDir, failed)
      }
      if (finalManifest.status !== 'passed' && exitCode === 0) exitCode = 1
    } catch (manifestError) {
      const failed = failedManifest(
        `The screen capture manifest could not be finalized: ${manifestError instanceof Error ? manifestError.message : String(manifestError)}`,
        manifest,
      )
      writeManifest(runDir, failed)
      writeGallery(runDir, failed)
      exitCode = exitCode === 0 ? 1 : exitCode
    }
    process.exitCode = exitCode
  }
  child.once('error', (error) => finish(1, null, error))
  child.once('exit', finish)
}

await main()

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
