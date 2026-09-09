import {
  appendFileSync,
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { copySourceWorkspace } from './inventory.mjs'
import {
  activeWorkspaces,
  interruptedResult,
  isInterrupted,
  reservePort,
  runCommand,
  waitForTermination,
} from './jobs.mjs'

export function baseEnvironment() {
  return {
    ...process.env,
    CI: '1',
    TURBO_TELEMETRY_DISABLED: '1',
    TURBO_FORCE: 'true',
  }
}

export async function runInIsolatedWorkspace(
  name,
  snapshot,
  commands,
  { reportDirectory, extraEnv = {}, logDirectory, portEnv, cleanup, inventory } = {},
) {
  const workspace = join(dirname(snapshot), `${name}-${process.pid}-${Date.now()}`)
  activeWorkspaces.add(workspace)
  try {
    if (isInterrupted()) return interruptedResult()
    copySourceWorkspace(snapshot, workspace, inventory)
    const tempDirectory = join(workspace, '.ci-tmp')
    mkdirSync(tempDirectory, { recursive: true })
    const env = {
      ...baseEnvironment(),
      ...extraEnv,
      TMPDIR: tempDirectory,
      EXPO_HOME: join(workspace, '.expo-home'),
      METRO_CACHE_ROOT: join(workspace, '.metro-cache'),
    }
    mkdirSync(env.EXPO_HOME, { recursive: true })
    mkdirSync(env.METRO_CACHE_ROOT, { recursive: true })

    let result = { code: 0 }
    const installCommands = [
      ['install-offline', 'pnpm', ['install', '--frozen-lockfile', '--offline']],
      ['install', 'pnpm', ['install', '--frozen-lockfile']],
    ]
    for (const [commandName, file, args] of installCommands) {
      if (isInterrupted()) {
        result = interruptedResult()
        break
      }
      result = await runCommand(`${name}-${commandName}`, file, args, {
        cwd: workspace,
        env,
        logDirectory,
      })
      if (result.code === 0 || result.interrupted || commandName === 'install') break
    }
    if (result.code === 0 && !isInterrupted()) {
      if (portEnv) env[portEnv] = String(await reservePort())
      for (const [commandName, file, args] of commands) {
        if (isInterrupted()) {
          result = interruptedResult()
          break
        }
        result = await runCommand(`${name}-${commandName}`, file, args, {
          cwd: workspace,
          env,
          logDirectory,
        })
        if (result.code !== 0) break
      }
    }
    if (isInterrupted() && waitForTermination()) await waitForTermination()
    if (reportDirectory) {
      for (const report of ['playwright-report', 'test-results']) {
        const source = join(workspace, report)
        if (existsSync(source)) {
          mkdirSync(join(reportDirectory, name), { recursive: true })
          cpSync(source, join(reportDirectory, name, report), { recursive: true })
        }
      }
    }
    return isInterrupted() ? { ...result, ...interruptedResult(result.logPath) } : result
  } finally {
    if (isInterrupted() && waitForTermination()) await waitForTermination()
    try {
      cleanup?.()
    } catch {
      /* Resource cleanup is best effort; the job's failure remains the primary result. */
    }
    activeWorkspaces.delete(workspace)
    rmSync(workspace, { recursive: true, force: true })
  }
}

export function acquireLock(root, runId) {
  const path = join(root, '.ci-local.lock')
  try {
    const descriptor = openSync(path, 'wx')
    writeFileSync(descriptor, `${process.pid}\n${runId}\n`, 'utf8')
    closeSync(descriptor)
    return () => {
      try {
        unlinkSync(path)
      } catch {
        /* The lock may already have been removed during cleanup. */
      }
    }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let owner = 'unknown process'
    try {
      owner = readFileSync(path, 'utf8').split('\n')[0] || owner
      if (/^\d+$/.test(owner)) process.kill(Number(owner), 0)
    } catch (ownerError) {
      if (ownerError.code === 'ESRCH') {
        unlinkSync(path)
        return acquireLock(root, runId)
      }
    }
    throw new Error(`Another local CI run owns ${path} (${owner})`)
  }
}

export function logEvent(reportDirectory, event) {
  const line = `${new Date().toISOString()} ${event.type} ${event.name}${event.reason ? ` (${event.reason})` : ''}\n`
  appendFileSync(join(reportDirectory, 'events.log'), line)
  if (event.type === 'start') console.log(`\nLocal CI: ${event.name}`)
  if (event.type === 'pass') console.log(`Local CI passed: ${event.name}`)
  if (event.type === 'fail') console.error(`Local CI failed: ${event.name}`)
  if (event.type === 'skip') console.error(`Local CI skipped: ${event.name} (${event.reason})`)
}

export function commandJob(name, file, args, options) {
  return { name, run: () => runCommand(name, file, args, options) }
}

export function isolatedJob(name, snapshot, commands, options) {
  return { name, run: () => runInIsolatedWorkspace(name, snapshot, commands, options) }
}
