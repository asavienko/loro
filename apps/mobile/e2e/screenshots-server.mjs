import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'

const port = Number(process.argv[2])
const require = createRequire(import.meta.url)
const expoCli = require.resolve('@expo/cli')

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`LORO_E2E_PORT must be an integer from 1 to 65535; received ${process.argv[2]}.`)
  process.exitCode = 1
} else {
  await assertPortAvailable(port)
  const child = spawn(process.execPath, [expoCli, 'start', '--web', '--port', String(port)], {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    detached: process.platform !== 'win32',
    stdio: 'inherit',
    env: process.env,
  })
  let stopping = false
  let finished = false
  let stopTimer
  const stop = (signal) => {
    if (stopping) return
    stopping = true
    signalProcessGroup(child, signal)
    stopTimer = setTimeout(() => {
      if (!finished) signalProcessGroup(child, 'SIGKILL')
    }, 5_000)
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))
  const finish = (code, signal) => {
    if (finished) return
    finished = true
    if (stopTimer !== undefined) clearTimeout(stopTimer)
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1)
  }
  child.once('error', () => finish(1, null))
  child.once('exit', finish)
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

function assertPortAvailable(port) {
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
