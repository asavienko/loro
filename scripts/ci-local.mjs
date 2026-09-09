#!/usr/bin/env node
/**
 * Full local CI orchestration.
 *
 * The shell wrapper owns environment/mode checks. This module owns the dependency graph,
 * bounded concurrency, isolated browser workspaces, and cleanup. Keeping this in Node makes the
 * scheduler testable without starting Docker, Expo, or a Rust build.
 */

import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_JOB_LIMIT = 2
const TERMINATION_GRACE_MS = 2_000

// These paths are generated during preparation, then consumed by isolated jobs. Tracked generated
// output stays in the snapshot so the isolated builds exercise the exact checkout state.
const generatedSourceRoots = [
  'apps/mobile/expo-env.d.ts',
  'apps/mobile/.expo/types/router.d.ts',
  'packages/core-rs/pkg',
  'packages/design-tokens/out',
  'packages/core-rs/bindings',
  'packages/core-rs/browser',
]

const excludedSourceDirectories = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'target',
  '.expo',
  'test-results',
  'playwright-report',
  '.ci-local-reports',
  '.local-builds',
  'apps/mobile/android',
  'apps/mobile/ios',
])

const excludedSourceNames = new Set(['dist', 'build', '.expo-export', '.expo-export-web'])
const excludedSourcePrefixes = new Set(['apps/mobile/android', 'apps/mobile/ios'])
const excludedSourceExtensions = new Set([
  '.agekey',
  '.db',
  '.db-journal',
  '.db-shm',
  '.db-wal',
  '.key',
  '.pem',
  '.p8',
  '.p12',
  '.sqlite',
  '.sqlite3',
])

function isPathInside(root, path) {
  const rel = relative(root, path)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))
}

export function parsePositiveInteger(value, name, fallback) {
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer; got ${value}`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer; got ${value}`)
  return parsed
}

function relativePath(root, path) {
  return relative(root, path).split('/').join('/')
}

function isSensitiveSourcePath(root, path) {
  const rel = relativePath(root, path)
  if (!rel || rel.startsWith('..')) return false
  const parts = rel.split('/')
  const basename = parts.at(-1) ?? ''
  const isEnvironmentFile =
    (basename.startsWith('.env') || basename.endsWith('.env')) && basename !== '.env.example'
  if (isEnvironmentFile || parts.includes('secrets')) return true
  if (
    excludedSourceExtensions.has(basename) ||
    [...excludedSourceExtensions].some((extension) => basename.endsWith(extension)) ||
    /\.(?:db|sqlite3?)(?:-|$)/.test(basename)
  )
    return true
  if (basename.endsWith('.hprof') || basename.endsWith('.keystore')) return true
  return false
}

function isExcludedSourcePath(root, path) {
  const rel = relativePath(root, path)
  if (!rel || rel.startsWith('..')) return false
  const parts = rel.split('/')
  if (isSensitiveSourcePath(root, path)) return true
  if (
    parts.some((part) => excludedSourceDirectories.has(part)) ||
    [...excludedSourcePrefixes].some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
  )
    return true
  const basename = parts.at(-1) ?? ''
  if (excludedSourceNames.has(basename)) return true
  return false
}

function isGeneratedSourcePath(root, path) {
  const rel = relativePath(root, path)
  return generatedSourceRoots.some(
    (candidate) => rel === candidate || rel.startsWith(`${candidate}/`),
  )
}

function gitSourcePaths(root) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  ).toString('utf8')
  return output.split('\0').filter(Boolean)
}

function statIfPresent(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function filesUnder(root, relativeRoot) {
  const absoluteRoot = join(root, relativeRoot)
  const rootStat = statIfPresent(absoluteRoot)
  if (!rootStat) return []
  if (rootStat.isFile() || rootStat.isSymbolicLink()) return [relativeRoot]
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(relativePath(root, path))
    }
  }
  visit(absoluteRoot)
  return files
}

export function createSourceInventory(root = ROOT) {
  const authoredPaths = new Set()
  const generatedPaths = new Set()
  for (const relativePathName of gitSourcePaths(root)) {
    const absolutePath = join(root, relativePathName)
    if (!statIfPresent(absolutePath)) continue
    if (isSensitiveSourcePath(root, absolutePath)) continue
    if (isGeneratedSourcePath(root, absolutePath)) generatedPaths.add(relativePathName)
    else if (!isExcludedSourcePath(root, absolutePath)) authoredPaths.add(relativePathName)
  }
  for (const generatedRoot of generatedSourceRoots) {
    for (const relativePathName of filesUnder(root, generatedRoot)) {
      const absolutePath = join(root, relativePathName)
      if (isGeneratedSourcePath(root, absolutePath) && !isSensitiveSourcePath(root, absolutePath))
        generatedPaths.add(relativePathName)
    }
  }
  return {
    authoredPaths: [...authoredPaths].sort(),
    generatedPaths: [...generatedPaths].sort(),
  }
}

function samePaths(left, right) {
  return left.length === right.length && left.every((path, index) => path === right[index])
}

function fingerprintPaths(root, paths) {
  const hash = createHash('sha256')
  for (const relativePathName of [...paths].sort()) {
    const path = join(root, relativePathName)
    hash.update(`${relativePathName}\0`)
    const stat = statIfPresent(path)
    if (!stat) {
      hash.update('missing\0')
      continue
    }
    if (stat.isSymbolicLink()) hash.update(`link:${readlinkSync(path)}\0`)
    else if (stat.isFile()) hash.update(readFileSync(path))
    else hash.update(`unsupported:${stat.mode}\0`)
  }
  return hash.digest('hex')
}

export function sourceFingerprint(root = ROOT, inventory = createSourceInventory(root)) {
  return fingerprintPaths(root, [...inventory.authoredPaths, ...inventory.generatedPaths])
}

function currentCommit(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
}

export function captureSourceIdentity(root = ROOT) {
  const inventory = createSourceInventory(root)
  return {
    commit: currentCommit(root),
    authoredPaths: inventory.authoredPaths,
    authoredFingerprint: fingerprintPaths(root, inventory.authoredPaths),
  }
}

export function assertSourceIdentity(root, identity, phase) {
  const commit = currentCommit(root)
  if (commit !== identity.commit)
    throw new Error(`Source commit changed during ${phase}: ${identity.commit} -> ${commit}`)
  const current = createSourceInventory(root)
  if (!samePaths(current.authoredPaths, identity.authoredPaths))
    throw new Error(`Authored source inventory changed during ${phase}`)
  const fingerprint = fingerprintPaths(root, identity.authoredPaths)
  if (fingerprint !== identity.authoredFingerprint)
    throw new Error(`Authored source contents changed during ${phase}`)
  return { commit, authoredFingerprint: fingerprint }
}

export function assertGeneratedIdentity(root, paths, fingerprint, phase) {
  const current = createSourceInventory(root)
  if (!samePaths(current.generatedPaths, paths))
    throw new Error(`Generated input inventory changed during ${phase}`)
  const currentFingerprint = fingerprintPaths(root, paths)
  if (currentFingerprint !== fingerprint)
    throw new Error(`Generated inputs changed during ${phase}`)
  return currentFingerprint
}

function assertSafeSymlink(source, sourcePath, inventory) {
  const linkTarget = readlinkSync(sourcePath)
  if (isAbsolute(linkTarget))
    throw new Error(`Refusing absolute symlink: ${relativePath(source, sourcePath)}`)
  const target = resolve(dirname(sourcePath), linkTarget)
  if (!isPathInside(source, target))
    throw new Error(
      `Refusing symlink outside source workspace: ${relativePath(source, sourcePath)}`,
    )
  if (
    !existsSync(target) ||
    (isExcludedSourcePath(source, target) && !isGeneratedSourcePath(source, target))
  )
    throw new Error(
      `Refusing symlink to excluded or missing path: ${relativePath(source, sourcePath)}`,
    )
  const targetRelative = relativePath(source, target)
  if (
    !inventory.has(targetRelative) &&
    ![...inventory].some((listedPath) => listedPath.startsWith(`${targetRelative}/`)) &&
    !isGeneratedSourcePath(source, target)
  )
    throw new Error(`Refusing symlink to unlisted path: ${relativePath(source, sourcePath)}`)
}

export function copySourceWorkspace(
  source,
  destination,
  inventory = createSourceInventory(source),
) {
  mkdirSync(destination, { recursive: true })
  const paths = [...new Set([...inventory.authoredPaths, ...inventory.generatedPaths])].sort()
  const listed = new Set(paths)
  for (const relativePathName of paths) {
    const sourcePath = join(source, relativePathName)
    const sourceStat = statIfPresent(sourcePath)
    if (!sourceStat) throw new Error(`Snapshot source is missing: ${relativePathName}`)
    if (sourceStat.isSymbolicLink()) {
      assertSafeSymlink(source, sourcePath, listed)
      const destinationPath = join(destination, relativePathName)
      mkdirSync(dirname(destinationPath), { recursive: true })
      symlinkSync(readlinkSync(sourcePath), destinationPath)
      continue
    }
    const destinationPath = join(destination, relativePathName)
    mkdirSync(dirname(destinationPath), { recursive: true })
    cpSync(sourcePath, destinationPath, { recursive: true, dereference: false })
  }
}

export function checkGeneratedDrift(root = ROOT) {
  const status = execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--',
      'packages/design-tokens/out',
      'packages/core-rs/bindings',
      'packages/core-rs/browser',
    ],
    { cwd: root, encoding: 'utf8' },
  ).trim()
  if (!status) return { code: 0, status: '' }
  return { code: 1, status }
}

export async function reservePort() {
  const server = createServer()
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to reserve a local port')
  const port = address.port
  await new Promise((resolvePromise) => server.close(resolvePromise))
  return port
}

export async function runJobs(
  jobs,
  { limit = DEFAULT_JOB_LIMIT, onEvent = () => {}, shouldStop = () => false } = {},
) {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error(`Job limit must be a positive integer; got ${limit}`)
  const states = new Map(jobs.map((job) => [job.name, 'pending']))
  const results = new Map()
  const running = new Map()
  let stopping = false

  const startReady = () => {
    let started = false
    for (const job of jobs) {
      if (running.size >= limit || stopping || shouldStop()) break
      if (states.get(job.name) !== 'pending') continue
      const dependencies = job.deps ?? []
      if (
        dependencies.some(
          (dependency) =>
            states.get(dependency) === 'failed' || states.get(dependency) === 'skipped',
        )
      ) {
        states.set(job.name, 'skipped')
        results.set(job.name, { code: 1, skipped: true, reason: 'dependency failed' })
        onEvent({ type: 'skip', name: job.name, reason: 'dependency failed' })
        continue
      }
      if (dependencies.some((dependency) => states.get(dependency) !== 'passed')) continue
      states.set(job.name, 'running')
      onEvent({ type: 'start', name: job.name })
      const promise = Promise.resolve()
        .then(() => (shouldStop() ? interruptedResult() : job.run()))
        .then((value) => {
          const result = typeof value === 'number' ? { code: value } : (value ?? { code: 0 })
          return shouldStop() && result.code === 0
            ? { ...result, ...interruptedResult(result.logPath) }
            : result
        })
        .catch((error) => ({ code: 1, error }))
      running.set(job.name, promise)
      started = true
    }
    return started
  }

  while (true) {
    startReady()
    if (running.size === 0) {
      const pending = jobs.filter((job) => states.get(job.name) === 'pending')
      if (pending.length) {
        for (const job of pending) {
          states.set(job.name, 'skipped')
          results.set(job.name, {
            code: 1,
            skipped: true,
            reason: stopping ? 'stopped' : 'dependency cycle',
          })
          onEvent({
            type: 'skip',
            name: job.name,
            reason: stopping ? 'stopped' : 'dependency cycle',
          })
        }
      }
      break
    }

    const completed = await Promise.race(
      [...running.entries()].map(([name, promise]) => promise.then((result) => ({ name, result }))),
    )
    running.delete(completed.name)
    results.set(completed.name, completed.result)
    if (completed.result.code === 0) {
      states.set(completed.name, 'passed')
      onEvent({ type: 'pass', name: completed.name, result: completed.result })
    } else {
      states.set(completed.name, 'failed')
      stopping = true
      onEvent({ type: 'fail', name: completed.name, result: completed.result })
    }
  }

  return {
    ok: [...states.values()].every((state) => state === 'passed'),
    states,
    results,
  }
}

let activeChildren = new Set()
let activeWorkspaces = new Set()
let ownedProcessGroups = new Map()
let interrupted = false
let terminationPromise

function signalChild(child, signal) {
  if (!child) return
  try {
    if (child.pid && process.platform !== 'win32') process.kill(-child.pid, signal)
    else if (child.exitCode === null) child.kill(signal)
  } catch {
    /* The process may have exited between the check and signal. */
  }
}

async function waitForActiveChildren(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (activeChildren.size && Date.now() < deadline) await delay(25)
}

function processGroupAlive(child) {
  if (process.platform === 'win32' || !child?.pid) return false
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    return error.code !== 'ESRCH'
  }
}

async function waitForOwnedProcessGroups(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (
    [...ownedProcessGroups.values()].some((child) => processGroupAlive(child)) &&
    Date.now() < deadline
  )
    await delay(25)
}

async function terminateProcessGroups() {
  for (const child of ownedProcessGroups.values()) signalChild(child, 'SIGTERM')
  await Promise.all([
    waitForActiveChildren(TERMINATION_GRACE_MS),
    waitForOwnedProcessGroups(TERMINATION_GRACE_MS),
  ])
  for (const child of ownedProcessGroups.values()) signalChild(child, 'SIGKILL')
  await Promise.all([
    waitForActiveChildren(TERMINATION_GRACE_MS),
    waitForOwnedProcessGroups(TERMINATION_GRACE_MS),
  ])
  ownedProcessGroups.clear()
}

export function terminateOwnedProcesses() {
  interrupted = true
  if (!terminationPromise) terminationPromise = terminateProcessGroups()
  return terminationPromise
}

function interruptedResult(logPath) {
  return { code: 130, interrupted: true, logPath }
}

function ensureNotInterrupted(phase) {
  if (interrupted) throw new Error(`Local CI interrupted during ${phase}`)
}

function commandLabel(file, args) {
  return [file, ...args].map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')
}

export function runCommand(name, file, args, { cwd = ROOT, env = process.env, logDirectory } = {}) {
  const logPath = logDirectory
    ? join(logDirectory, `${name.replaceAll(/[^a-zA-Z0-9._-]/g, '_')}.log`)
    : null
  if (logPath) {
    mkdirSync(dirname(logPath), { recursive: true })
    writeFileSync(logPath, `$ ${commandLabel(file, args)}\n`, 'utf8')
  }
  if (interrupted) {
    if (logPath) appendFileSync(logPath, 'Skipped because local CI was interrupted.\n')
    return Promise.resolve(interruptedResult(logPath))
  }
  const child = spawn(file, args, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  activeChildren.add(child)
  if (child.pid) ownedProcessGroups.set(child.pid, child)
  if (interrupted) signalChild(child, 'SIGTERM')
  const stream = (chunk) => {
    const text = chunk.toString()
    if (logPath) appendFileSync(logPath, text)
    for (const line of text.split(/(?<=\n)/))
      if (line.trim()) process.stdout.write(`[${name}] ${line}`)
  }
  child.stdout?.on('data', stream)
  child.stderr?.on('data', stream)
  return new Promise((resolvePromise) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      activeChildren.delete(child)
      if (!interrupted && child.pid) ownedProcessGroups.delete(child.pid)
      const finalResult = interrupted
        ? { ...result, ...interruptedResult(logPath) }
        : { ...result, logPath }
      resolvePromise(finalResult)
    }
    child.once('error', (error) => finish({ code: 1, error }))
    child.once('exit', (code, signal) => {
      finish({ code: code ?? 1, signal })
    })
  })
}

export function cleanupDockerResources(
  { containers = [], networks = [], image },
  run = (...args) =>
    execFileSync('docker', args, { stdio: 'ignore', timeout: TERMINATION_GRACE_MS }),
) {
  for (const container of containers) {
    try {
      run('rm', '--force', container)
    } catch {
      /* A resource may not have been created or may already be gone. */
    }
  }
  for (const network of networks) {
    try {
      run('network', 'rm', network)
    } catch {
      /* A resource may not have been created or may already be gone. */
    }
  }
  if (image) {
    try {
      run('image', 'rm', '--force', image)
    } catch {
      /* The image may not have been built or may already be gone. */
    }
  }
}

function baseEnvironment() {
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
    if (interrupted) return interruptedResult()
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
      if (interrupted) {
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
    if (result.code === 0 && !interrupted) {
      if (portEnv) env[portEnv] = String(await reservePort())
      for (const [commandName, file, args] of commands) {
        if (interrupted) {
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
    if (interrupted && terminationPromise) await terminationPromise
    if (reportDirectory) {
      for (const report of ['playwright-report', 'test-results']) {
        const source = join(workspace, report)
        if (existsSync(source)) {
          mkdirSync(join(reportDirectory, name), { recursive: true })
          cpSync(source, join(reportDirectory, name, report), { recursive: true })
        }
      }
    }
    return interrupted ? { ...result, ...interruptedResult(result.logPath) } : result
  } finally {
    if (interrupted && terminationPromise) await terminationPromise
    try {
      cleanup?.()
    } catch {
      /* Resource cleanup is best effort; the job's failure remains the primary result. */
    }
    activeWorkspaces.delete(workspace)
    rmSync(workspace, { recursive: true, force: true })
  }
}

function acquireLock(root, runId) {
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

function logEvent(reportDirectory, event) {
  const line = `${new Date().toISOString()} ${event.type} ${event.name}${event.reason ? ` (${event.reason})` : ''}\n`
  appendFileSync(join(reportDirectory, 'events.log'), line)
  if (event.type === 'start') console.log(`\nLocal CI: ${event.name}`)
  if (event.type === 'pass') console.log(`Local CI passed: ${event.name}`)
  if (event.type === 'fail') console.error(`Local CI failed: ${event.name}`)
  if (event.type === 'skip') console.error(`Local CI skipped: ${event.name} (${event.reason})`)
}

function commandJob(name, file, args, options) {
  return { name, run: () => runCommand(name, file, args, options) }
}

function isolatedJob(name, snapshot, commands, options) {
  return { name, run: () => runInIsolatedWorkspace(name, snapshot, commands, options) }
}

async function main() {
  const turboConcurrency = parsePositiveInteger(
    process.env.LORO_CI_CONCURRENCY,
    'LORO_CI_CONCURRENCY',
    2,
  )
  const jobLimit = parsePositiveInteger(process.env.LORO_CI_JOBS, 'LORO_CI_JOBS', DEFAULT_JOB_LIMIT)
  const runId = `${new Date().toISOString().replaceAll(/[^0-9]/g, '')}-${process.pid}`
  const reportDirectory = join(ROOT, '.ci-local-reports', runId)
  mkdirSync(reportDirectory, { recursive: true })
  const releaseLock = acquireLock(ROOT, runId)
  const environment = baseEnvironment()
  const logDirectory = join(reportDirectory, 'logs')
  mkdirSync(logDirectory, { recursive: true })
  const summaryPath = join(reportDirectory, 'summary.json')
  writeFileSync(
    summaryPath,
    `${JSON.stringify({ runId, jobLimit, turboConcurrency, status: 'running' }, null, 2)}\n`,
    'utf8',
  )
  let startingIdentity
  let snapshot

  try {
    startingIdentity = captureSourceIdentity(ROOT)
    writeFileSync(
      join(reportDirectory, 'source-identity.json'),
      `${JSON.stringify(
        {
          commit: startingIdentity.commit,
          authoredFingerprint: startingIdentity.authoredFingerprint,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    const install = await runCommand('install', 'pnpm', ['install', '--frozen-lockfile'], {
      cwd: ROOT,
      env: environment,
      logDirectory,
    })
    if (install.code !== 0) throw new Error('Dependency installation failed')
    ensureNotInterrupted('dependency installation')
    assertSourceIdentity(ROOT, startingIdentity, 'dependency installation')

    const preparation = await runJobs(
      [
        commandJob('core-rs-build', 'pnpm', ['core-rs:build'], {
          cwd: ROOT,
          env: environment,
          logDirectory,
        }),
        commandJob('tokens-build', 'pnpm', ['tokens:build'], {
          cwd: ROOT,
          env: environment,
          logDirectory,
        }),
        commandJob('expo-routes', process.execPath, ['scripts/ci-expo-routes.mjs'], {
          cwd: ROOT,
          env: environment,
          logDirectory,
        }),
        commandJob(
          'expo-env',
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import path from 'node:path'; import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const cli = path.dirname(require.resolve('@expo/cli/package.json')); await require(path.join(cli, 'build/src/start/server/type-generation/expo-env.js')).writeExpoEnvDTS(path.resolve('apps/mobile'));`,
          ],
          { cwd: ROOT, env: environment, logDirectory },
        ),
        commandJob('chromium-install', 'pnpm', ['test:e2e:install'], {
          cwd: ROOT,
          env: environment,
          logDirectory,
        }),
      ],
      {
        limit: jobLimit,
        onEvent: (event) => logEvent(reportDirectory, event),
        shouldStop: () => interrupted,
      },
    )
    if (!preparation.ok) throw new Error('Preparation failed')
    if (!existsSync(join(ROOT, 'packages/core-rs/pkg/loro_core_bg.wasm')))
      throw new Error('WASM output is missing')
    ensureNotInterrupted('preparation')
    assertSourceIdentity(ROOT, startingIdentity, 'preparation')

    const check = await runCommand(
      'check',
      'pnpm',
      ['check', `--concurrency=${turboConcurrency}`],
      {
        cwd: ROOT,
        env: environment,
        logDirectory,
      },
    )
    if (check.code !== 0) throw new Error('Fast check failed')
    ensureNotInterrupted('fast check')
    assertSourceIdentity(ROOT, startingIdentity, 'fast check')

    const followupJobs = [
      commandJob('auth-postgres', 'bash', ['scripts/ci-auth-postgres.sh'], {
        cwd: ROOT,
        env: { ...environment, AUTH_TEST_DATABASE_URL: '', LORO_TEST_DATABASE_URL: '' },
        logDirectory,
      }),
      commandJob('format', 'pnpm', ['format:check'], { cwd: ROOT, env: environment, logDirectory }),
      commandJob('golden', 'cargo', ['test', '--test', 'golden', '--', '--nocapture'], {
        cwd: join(ROOT, 'packages/core-rs'),
        env: environment,
        logDirectory,
      }),
    ]
    if (process.env.CI_BASE_REF) {
      followupJobs.push(
        commandJob(
          'commitlint',
          'pnpm',
          ['exec', 'commitlint', '--from', process.env.CI_BASE_REF, '--to', 'HEAD'],
          { cwd: ROOT, env: environment, logDirectory },
        ),
      )
    } else {
      console.log('Commit range not provided; commit lint is omitted.')
    }
    const goldenIndex = followupJobs.findIndex((job) => job.name === 'golden')
    if (
      !existsSync(join(ROOT, 'packages/core-rs/tests/golden.rs')) &&
      !existsSync(join(ROOT, 'packages/core-rs/tests/golden/main.rs'))
    ) {
      followupJobs.splice(goldenIndex, 1)
      console.log('Golden test target is absent; it is omitted.')
    }
    followupJobs.push({
      name: 'generated-drift',
      run: () => {
        const drift = checkGeneratedDrift(ROOT)
        if (drift.code) console.error(`Generated output differs from Git:\n${drift.status}`)
        return { code: drift.code }
      },
    })
    const followup = await runJobs(followupJobs, {
      limit: jobLimit,
      onEvent: (event) => logEvent(reportDirectory, event),
      shouldStop: () => interrupted,
    })
    if (!followup.ok) throw new Error('Post-check validation failed')
    ensureNotInterrupted('post-check validation')
    assertSourceIdentity(ROOT, startingIdentity, 'post-check validation')

    snapshot = mkdtempSync(join(tmpdir(), 'loro-ci-snapshot-'))
    ensureNotInterrupted('snapshot creation')
    const snapshotInventory = createSourceInventory(ROOT)
    if (!samePaths(snapshotInventory.authoredPaths, startingIdentity.authoredPaths))
      throw new Error('Authored source inventory changed before snapshot creation')
    const sourceAuthoredFingerprint = fingerprintPaths(ROOT, snapshotInventory.authoredPaths)
    if (sourceAuthoredFingerprint !== startingIdentity.authoredFingerprint)
      throw new Error('Authored source changed before snapshot creation')
    const sourceGeneratedFingerprint = fingerprintPaths(ROOT, snapshotInventory.generatedPaths)
    copySourceWorkspace(ROOT, snapshot, snapshotInventory)
    ensureNotInterrupted('snapshot copy')
    assertSourceIdentity(ROOT, startingIdentity, 'snapshot copy')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      sourceGeneratedFingerprint,
      'snapshot copy',
    )
    const snapshotAuthoredFingerprint = fingerprintPaths(snapshot, snapshotInventory.authoredPaths)
    if (snapshotAuthoredFingerprint !== sourceAuthoredFingerprint)
      throw new Error('Snapshot authored source differs from the starting source')
    const snapshotGeneratedFingerprint = fingerprintPaths(
      snapshot,
      snapshotInventory.generatedPaths,
    )
    if (snapshotGeneratedFingerprint !== sourceGeneratedFingerprint)
      throw new Error('Snapshot generated inputs differ from the source')
    writeFileSync(
      join(reportDirectory, 'source-identity.json'),
      `${JSON.stringify(
        {
          commit: startingIdentity.commit,
          authoredFingerprint: snapshotAuthoredFingerprint,
          generatedFingerprint: snapshotGeneratedFingerprint,
          generatedPaths: snapshotInventory.generatedPaths,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const browserEnvironment = { ...environment }
    const browserJobs = []
    const browserSuites = [
      ['learner-e2e', 'test:e2e'],
      ['pseudo-locale-e2e', 'test:e2e:pseudo-locale'],
      ['workbench-e2e', 'test:e2e:workbench'],
      ['production-e2e', 'test:e2e:bundle'],
    ]
    for (const [name, script] of browserSuites) {
      browserJobs.push(
        isolatedJob(name, snapshot, [['suite', 'pnpm', [script]]], {
          reportDirectory,
          logDirectory,
          portEnv: 'LORO_E2E_PORT',
          inventory: snapshotInventory,
          extraEnv: browserEnvironment,
        }),
      )
    }
    const imageCheckPrefix = `loro-image-check-${runId}`
    const apiSmokeContainer = `loro-built-api-check-${runId}`
    browserJobs.push(
      isolatedJob(
        'mobile-bundle',
        snapshot,
        [['bundle', 'pnpm', ['--filter', '@loro/mobile', 'bundle']]],
        {
          reportDirectory,
          logDirectory,
          inventory: snapshotInventory,
          extraEnv: browserEnvironment,
        },
      ),
      isolatedJob(
        'api-verification',
        snapshot,
        [
          ['api-build', 'pnpm', ['--filter', '@loro/api', 'build']],
          ['api-smoke', process.execPath, ['scripts/ci-api-smoke.mjs']],
          [
            'image-build',
            'docker',
            [
              'build',
              '--platform',
              'linux/amd64',
              '-f',
              'apps/api/Dockerfile',
              '-t',
              `loro-api:local-check-${runId}`,
              '.',
            ],
          ],
          ['image-check', 'bash', ['scripts/ci-api-image.sh', `loro-api:local-check-${runId}`]],
        ],
        {
          reportDirectory,
          logDirectory,
          inventory: snapshotInventory,
          extraEnv: {
            ...browserEnvironment,
            LORO_API_IMAGE_CHECK_PREFIX: imageCheckPrefix,
            LORO_API_SMOKE_CONTAINER: apiSmokeContainer,
          },
          cleanup: () => {
            cleanupDockerResources({
              containers: [
                imageCheckPrefix,
                `${imageCheckPrefix}-database`,
                `${imageCheckPrefix}-content`,
                apiSmokeContainer,
              ],
              networks: [`${imageCheckPrefix}-network`],
              image: `loro-api:local-check-${runId}`,
            })
          },
        },
      ),
    )
    const browserResult = await runJobs(browserJobs, {
      limit: jobLimit,
      onEvent: (event) => logEvent(reportDirectory, event),
      shouldStop: () => interrupted,
    })
    if (!browserResult.ok) throw new Error('Isolated verification failed')
    ensureNotInterrupted('isolated verification')
    assertSourceIdentity(ROOT, startingIdentity, 'isolated verification')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      snapshotGeneratedFingerprint,
      'isolated verification',
    )

    const benchmark = await runCommand(
      'benchmarks',
      'cargo',
      ['bench', '--bench', 'core_benches', '--', '--warm-up-time', '1', '--measurement-time', '2'],
      {
        cwd: join(ROOT, 'packages/core-rs'),
        env: environment,
        logDirectory,
      },
    )
    if (benchmark.code !== 0) throw new Error('Benchmarks failed')
    ensureNotInterrupted('benchmarks')
    assertSourceIdentity(ROOT, startingIdentity, 'benchmarks')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      snapshotGeneratedFingerprint,
      'benchmarks',
    )
    ensureNotInterrupted('final validation')

    const summary = {
      runId,
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      jobLimit,
      turboConcurrency,
      sourceFingerprint: snapshotAuthoredFingerprint,
      generatedFingerprint: snapshotGeneratedFingerprint,
      status: 'passed',
    }
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(`Local CI passed. Reports: ${reportDirectory}`)
  } catch (error) {
    writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          runId,
          jobLimit,
          turboConcurrency,
          status: 'failed',
          interrupted,
          commit: startingIdentity?.commit,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    throw error
  } finally {
    if (terminationPromise) await terminationPromise
    for (const workspace of activeWorkspaces) rmSync(workspace, { recursive: true, force: true })
    if (snapshot) rmSync(snapshot, { recursive: true, force: true })
    releaseLock()
  }
}

const signalHandler = () => terminateOwnedProcesses()
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Local CI failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = interrupted ? 130 : 1
  })
}
