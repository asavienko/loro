import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { DEFAULT_JOB_LIMIT, ROOT, TERMINATION_GRACE_MS } from './root.mjs'

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

export function ensureNotInterrupted(phase) {
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

export function isInterrupted() {
  return interrupted
}

export function waitForTermination() {
  return terminationPromise
}

export { interruptedResult, activeWorkspaces }
