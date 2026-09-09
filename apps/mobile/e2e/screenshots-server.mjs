import { createServer } from 'node:net'
import { spawn } from 'node:child_process'

const port = Number(process.argv[2])

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`LORO_E2E_PORT must be an integer from 1 to 65535; received ${process.argv[2]}.`)
  process.exitCode = 1
} else {
  await assertPortAvailable(port)
  const child = spawn('pnpm', ['exec', 'expo', 'start', '--web', '--port', String(port)], {
    stdio: 'inherit',
    env: process.env,
  })
  let stopping = false
  const stop = (signal) => {
    if (stopping) return
    stopping = true
    child.kill(signal)
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal === null ? 1 : 0)
  })
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
