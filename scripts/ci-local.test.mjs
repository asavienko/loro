import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import {
  assertSourceIdentity,
  captureSourceIdentity,
  cleanupDockerResources,
  copySourceWorkspace,
  createSourceInventory,
  parsePositiveInteger,
  runCommand,
  runInIsolatedWorkspace,
  runJobs,
  sourceFingerprint,
  terminateOwnedProcesses,
} from './ci-local.mjs'

test('parsePositiveInteger accepts a value and fallback', () => {
  assert.equal(parsePositiveInteger(undefined, 'JOBS', 2), 2)
  assert.equal(parsePositiveInteger('4', 'JOBS', 2), 4)
})

test('parsePositiveInteger rejects zero, decimals and non-numbers', () => {
  for (const value of ['0', '1.5', 'many', '-2']) {
    assert.throws(() => parsePositiveInteger(value, 'JOBS', 2), /JOBS must be a positive integer/)
  }
})

test('runJobs respects the limit and dependency order', async () => {
  let active = 0
  let maximum = 0
  const events = []
  const work = (name, milliseconds) => async () => {
    events.push(`start:${name}`)
    active += 1
    maximum = Math.max(maximum, active)
    await delay(milliseconds)
    active -= 1
    events.push(`finish:${name}`)
    return { code: 0 }
  }

  const result = await runJobs(
    [
      { name: 'a', run: work('a', 20) },
      { name: 'b', run: work('b', 20) },
      { name: 'c', deps: ['a'], run: work('c', 1) },
    ],
    { limit: 2 },
  )

  assert.equal(result.ok, true)
  assert.equal(maximum, 2)
  assert.ok(events.indexOf('finish:a') < events.indexOf('start:c'))
})

test('runJobs stops scheduling after a failure and skips dependents', async () => {
  const started = []
  const result = await runJobs(
    [
      { name: 'failed', run: async () => ({ code: 1 }) },
      { name: 'dependent', deps: ['failed'], run: async () => started.push('dependent') },
      { name: 'independent', run: async () => started.push('independent') },
    ],
    { limit: 1 },
  )

  assert.equal(result.ok, false)
  assert.deepEqual(started, [])
  assert.equal(result.states.get('dependent'), 'skipped')
  assert.equal(result.states.get('independent'), 'skipped')
})

test('runJobs reports a dependency cycle as skipped', async () => {
  const result = await runJobs([
    { name: 'a', deps: ['b'], run: async () => ({ code: 0 }) },
    { name: 'b', deps: ['a'], run: async () => ({ code: 0 }) },
  ])
  assert.equal(result.ok, false)
  assert.equal(result.states.get('a'), 'skipped')
  assert.equal(result.states.get('b'), 'skipped')
})

test('runJobs does not launch work after cancellation', async () => {
  let launched = false
  const result = await runJobs([{ name: 'cancelled', run: async () => (launched = true) }], {
    shouldStop: () => true,
  })
  assert.equal(result.ok, false)
  assert.equal(launched, false)
  assert.equal(result.states.get('cancelled'), 'skipped')
})

test('copySourceWorkspace uses Git inventory and excludes secrets and transient trees', () => {
  const source = mkdtempSync(join(tmpdir(), 'loro-ci-source-'))
  const destination = mkdtempSync(join(tmpdir(), 'loro-ci-destination-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: source })
    writeFileSync(
      join(source, '.gitignore'),
      'node_modules/\ntarget/\napps/mobile/android/\n*.env\n*.pem\n*.agekey\n*.sqlite3\n',
    )
    writeFileSync(join(source, 'README.md'), 'read me\n')
    writeFileSync(join(source, '.env.example'), 'PLACEHOLDER=1\n')
    writeFileSync(join(source, 'tracked-delete.txt'), 'delete me\n')
    mkdirSync(join(source, 'src'))
    writeFileSync(join(source, 'src', 'edited.ts'), 'original\n')
    writeFileSync(join(source, 'src', 'tracked-private.pem'), 'PRIVATE KEY\n')
    writeFileSync(join(source, 'src', 'tracked.env'), 'SECRET=1\n')
    execFileSync('git', ['add', '.'], { cwd: source })
    execFileSync('git', ['add', '-f', 'src/tracked-private.pem'], { cwd: source })
    execFileSync('git', ['add', '-f', 'src/tracked.env'], { cwd: source })
    execFileSync(
      'git',
      ['-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture'],
      { cwd: source },
    )
    writeFileSync(join(source, 'src', 'edited.ts'), 'edited\n')
    writeFileSync(join(source, 'src', 'new-file.ts'), 'export const value = 1\n')
    rmSync(join(source, 'tracked-delete.txt'))
    writeFileSync(join(source, '.env.local'), 'SECRET=1\n')
    writeFileSync(join(source, 'local.env'), 'SECRET=1\n')
    writeFileSync(join(source, 'private.pem'), 'PRIVATE KEY\n')
    writeFileSync(join(source, 'identity.agekey'), 'AGE-SECRET-KEY\n')
    writeFileSync(join(source, 'learner.sqlite3'), 'learner data\n')
    mkdirSync(join(source, 'node_modules'))
    writeFileSync(join(source, 'node_modules', 'dependency.js'), 'module.exports = 1\n')
    mkdirSync(join(source, 'target'))
    writeFileSync(join(source, 'target', 'debug.bin'), 'generated\n')
    mkdirSync(join(source, 'apps/mobile/android'), { recursive: true })
    writeFileSync(join(source, 'apps/mobile/android', 'generated.txt'), 'native output\n')
    mkdirSync(join(source, 'packages/core-rs/pkg'), { recursive: true })
    writeFileSync(join(source, 'packages/core-rs/pkg', 'loro_core_bg.wasm'), 'wasm\n')
    writeFileSync(join(source, 'packages/core-rs/pkg', 'unexpected.pem'), 'PRIVATE KEY\n')
    mkdirSync(join(source, 'apps/mobile'), { recursive: true })
    writeFileSync(join(source, 'apps/mobile/expo-env.d.ts'), 'declare const expo: true\n')
    mkdirSync(join(source, 'apps/mobile/.expo/types'), { recursive: true })
    writeFileSync(
      join(source, 'apps/mobile/.expo/types/router.d.ts'),
      'declare const router: true\n',
    )
    execFileSync('ln', ['-s', 'README.md', join(source, 'safe-link')])

    const inventory = createSourceInventory(source)
    copySourceWorkspace(source, destination, inventory)

    assert.equal(existsSync(join(destination, 'README.md')), true)
    assert.equal(existsSync(join(destination, 'src', 'edited.ts')), true)
    assert.equal(existsSync(join(destination, 'src', 'new-file.ts')), true)
    assert.equal(existsSync(join(destination, 'tracked-delete.txt')), false)
    assert.equal(existsSync(join(destination, '.env.example')), true)
    assert.equal(existsSync(join(destination, '.env.local')), false)
    assert.equal(existsSync(join(destination, 'local.env')), false)
    assert.equal(existsSync(join(destination, 'private.pem')), false)
    assert.equal(existsSync(join(destination, 'src/tracked-private.pem')), false)
    assert.equal(existsSync(join(destination, 'src/tracked.env')), false)
    assert.equal(existsSync(join(destination, 'identity.agekey')), false)
    assert.equal(existsSync(join(destination, 'learner.sqlite3')), false)
    assert.equal(existsSync(join(destination, 'node_modules')), false)
    assert.equal(existsSync(join(destination, 'target')), false)
    assert.equal(existsSync(join(destination, 'apps/mobile/android')), false)
    assert.equal(existsSync(join(destination, 'packages/core-rs/pkg/loro_core_bg.wasm')), true)
    assert.equal(existsSync(join(destination, 'packages/core-rs/pkg/unexpected.pem')), false)
    assert.equal(existsSync(join(destination, 'apps/mobile/expo-env.d.ts')), true)
    assert.equal(existsSync(join(destination, 'apps/mobile/.expo/types/router.d.ts')), true)
    assert.equal(existsSync(join(destination, 'safe-link')), true)
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(destination, { recursive: true, force: true })
  }
})

test('copySourceWorkspace rejects symlinks that escape the source workspace', () => {
  const source = mkdtempSync(join(tmpdir(), 'loro-ci-unsafe-source-'))
  const destination = mkdtempSync(join(tmpdir(), 'loro-ci-unsafe-destination-'))
  const outside = mkdtempSync(join(tmpdir(), 'loro-ci-unsafe-target-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: source })
    writeFileSync(join(source, 'README.md'), 'read me\n')
    execFileSync('git', ['add', 'README.md'], { cwd: source })
    execFileSync(
      'git',
      ['-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture'],
      { cwd: source },
    )
    writeFileSync(join(outside, 'secret.txt'), 'private\n')
    execFileSync('ln', [
      '-s',
      join('..', basename(outside), 'secret.txt'),
      join(source, 'unsafe-link'),
    ])

    const inventory = createSourceInventory(source)
    assert.throws(
      () => copySourceWorkspace(source, destination, inventory),
      /Refusing symlink outside source workspace: unsafe-link/,
    )
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(destination, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test('copySourceWorkspace rejects absolute symlinks inside the source workspace', () => {
  const source = mkdtempSync(join(tmpdir(), 'loro-ci-absolute-source-'))
  const destination = mkdtempSync(join(tmpdir(), 'loro-ci-absolute-destination-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: source })
    writeFileSync(join(source, 'README.md'), 'read me\n')
    execFileSync('git', ['add', 'README.md'], { cwd: source })
    execFileSync(
      'git',
      ['-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture'],
      { cwd: source },
    )
    execFileSync('ln', ['-s', join(source, 'README.md'), join(source, 'absolute-link')])

    const inventory = createSourceInventory(source)
    assert.throws(
      () => copySourceWorkspace(source, destination, inventory),
      /Refusing absolute symlink: absolute-link/,
    )
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(destination, { recursive: true, force: true })
  }
})

test('source identity detects edits and snapshot drift', () => {
  const source = mkdtempSync(join(tmpdir(), 'loro-ci-identity-source-'))
  const snapshot = mkdtempSync(join(tmpdir(), 'loro-ci-identity-snapshot-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: source })
    writeFileSync(join(source, 'source.ts'), 'before\n')
    execFileSync('git', ['add', 'source.ts'], { cwd: source })
    execFileSync(
      'git',
      ['-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture'],
      { cwd: source },
    )
    const identity = captureSourceIdentity(source)
    const inventory = createSourceInventory(source)
    copySourceWorkspace(source, snapshot, inventory)
    assert.equal(sourceFingerprint(snapshot, inventory), sourceFingerprint(source, inventory))

    writeFileSync(join(source, 'source.ts'), 'after\n')
    assert.throws(
      () => assertSourceIdentity(source, identity, 'identity test'),
      /Authored source contents changed during identity test/,
    )
    assert.notEqual(sourceFingerprint(snapshot, inventory), sourceFingerprint(source, inventory))
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(snapshot, { recursive: true, force: true })
  }
})

test('runJobs converts a thrown child-launch error into a failed job', async () => {
  const result = await runJobs([
    {
      name: 'launch',
      run: async () => {
        throw new Error('spawn failed')
      },
    },
  ])
  assert.equal(result.ok, false)
  assert.equal(result.states.get('launch'), 'failed')
  assert.match(result.results.get('launch').error.message, /spawn failed/)
})

test('isolated cancellation kills descendants before deleting the workspace', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'loro-ci-cancel-'))
  const readyPath = join(directory, 'ready')
  const binDirectory = join(directory, 'bin')
  mkdirSync(binDirectory)
  writeFileSync(join(binDirectory, 'pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  const originalPath = process.env.PATH
  try {
    process.env.PATH = `${binDirectory}:${originalPath}`
    const grandchildScript = "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
    const parentScript = `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs'; const grandchild = spawn(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(grandchildScript)}], { stdio: 'ignore' }); writeFileSync(process.argv[1], String(grandchild.pid)); setInterval(() => {}, 1000)`
    const snapshot = mkdtempSync(join(directory, 'snapshot-'))
    const running = runInIsolatedWorkspace(
      'cancellable',
      snapshot,
      [['child', process.execPath, ['--input-type=module', '-e', parentScript, readyPath]]],
      { inventory: { authoredPaths: [], generatedPaths: [] }, logDirectory: directory },
    )
    for (let attempt = 0; attempt < 100 && !existsSync(readyPath); attempt++) await delay(10)
    assert.equal(existsSync(readyPath), true)
    const workspaceName = readdirSync(directory).find((entry) => entry.startsWith('cancellable-'))
    assert.ok(workspaceName)
    const grandchildPid = Number(readFileSync(readyPath, 'utf8'))
    const startedAt = Date.now()
    const termination = terminateOwnedProcesses()
    const result = await running
    await termination
    assert.equal(result.code, 130)
    assert.equal(result.interrupted, true)
    assert.ok(Date.now() - startedAt < 5_000)
    assert.equal(existsSync(join(directory, workspaceName)), false)
    assert.throws(() => process.kill(grandchildPid, 0), { code: 'ESRCH' })

    const skipped = await runCommand(
      'after-cancel',
      process.execPath,
      ['-e', 'throw Error("launched")'],
      { logDirectory: directory },
    )
    assert.equal(skipped.code, 130)
    assert.equal(skipped.interrupted, true)
  } finally {
    process.env.PATH = originalPath
    rmSync(directory, { recursive: true, force: true })
  }
})

test('cleanupDockerResources attempts every run-owned resource', () => {
  const calls = []
  cleanupDockerResources(
    {
      containers: ['app', 'database', 'content', 'smoke'],
      networks: ['network'],
      image: 'image',
    },
    (...args) => {
      calls.push(args)
      if (args.at(-1) === 'app') throw new Error('already gone')
    },
  )
  assert.deepEqual(calls, [
    ['rm', '--force', 'app'],
    ['rm', '--force', 'database'],
    ['rm', '--force', 'content'],
    ['rm', '--force', 'smoke'],
    ['network', 'rm', 'network'],
    ['image', 'rm', '--force', 'image'],
  ])
})
