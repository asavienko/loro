import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout } from 'node:timers/promises'

// Allocate a free port so this check does not reuse a developer's running API.
const reservation = createServer()
await new Promise((resolve, reject) => {
  reservation.once('error', reject)
  reservation.listen(0, '127.0.0.1', resolve)
})
const { port } = reservation.address()
await new Promise((resolve) => reservation.close(resolve))
const child = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env: { ...process.env, PORT: String(port), AI_PROVIDER: 'stub' },
  stdio: 'inherit',
})
let spawnError
child.on('error', (error) => {
  spawnError = error
})
const stop = () => child.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
try {
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    if (spawnError) throw spawnError
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Built API exited before readiness')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health/ready`, {
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        console.log('Built API ready:', await response.text())
        ready = true
        break
      }
    } catch {
      /* Keep polling while the API boots. */
    }
    await setTimeout(1000)
  }
  if (!ready) throw new Error('Built API failed its readiness gate')
} finally {
  stop()
  const forceStop = globalThis.setTimeout(() => child.kill('SIGKILL'), 5000)
  forceStop.unref()
  if (child.exitCode === null && child.signalCode === null && !spawnError) {
    await new Promise((resolve) => child.once('exit', resolve))
  }
  clearTimeout(forceStop)
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
}
