import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout } from 'node:timers/promises'

// Never connect this check to a developer/deployed database or inherit provider secrets. Local CI
// supplies a run-specific name so parent cleanup can remove the container after forced termination.
const container = process.env.LORO_API_SMOKE_CONTAINER ?? `loro-built-api-check-${process.pid}`
let child
let spawnError
let stopping = false
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const stop = () => {
  stopping = true
  child?.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
try {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_PASSWORD=loro-test-only',
    '-e',
    'POSTGRES_DB=loro_smoke_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  )
  let databaseReady = false
  for (let attempt = 0; attempt < 30; attempt++) {
    if (stopping) throw new Error('Built API check interrupted')
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'loro_smoke_test',
      )
      databaseReady = true
      break
    } catch {
      await setTimeout(1000)
    }
  }
  if (!databaseReady) throw new Error('Disposable PostgreSQL failed readiness')
  const databasePort = docker('port', container, '5432/tcp').split(':').at(-1)
  const reservation = createServer()
  await new Promise((resolve, reject) => {
    reservation.once('error', reject)
    reservation.listen(0, '127.0.0.1', resolve)
  })
  const { port } = reservation.address()
  await new Promise((resolve) => reservation.close(resolve))
  child = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      PORT: String(port),
      AI_PROVIDER: 'stub',
      AUTH_ENABLED: 'false',
      DATABASE_URL: `postgresql://postgres:loro-test-only@127.0.0.1:${databasePort}/loro_smoke_test`,
    },
    stdio: 'inherit',
  })
  child.on('error', (error) => {
    spawnError = error
  })
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    if (stopping) throw new Error('Built API check interrupted')
    if (spawnError) throw spawnError
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Built API exited before readiness')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health/ready`, {
        signal: AbortSignal.timeout(1000),
      })
      const body = await response.json()
      if (response.ok && body.checks?.database === 'ok' && body.checks?.merge === 'ok') {
        console.log('Built API ready:', JSON.stringify(body))
        ready = true
        break
      }
    } catch {
      /* Keep polling while the API boots. */
    }
    await setTimeout(1000)
  }
  if (!ready) throw new Error('Built API failed its durable readiness gate')
} finally {
  stop()
  if (child && child.exitCode === null && child.signalCode === null && !spawnError) {
    const forceStop = globalThis.setTimeout(() => child.kill('SIGKILL'), 5000)
    forceStop.unref()
    await new Promise((resolve) => child.once('exit', resolve))
    clearTimeout(forceStop)
  }
  try {
    docker('rm', '-f', container)
  } catch {
    /* A failed creation leaves nothing to remove. */
  }
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
}
