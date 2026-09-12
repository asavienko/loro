import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appBundleFromZipListing,
  availableIosSimulators,
  ensureSimulatorBooted,
  installSimulatorZip,
  pickSimulatorForScenarios,
  prepareIosEvidenceRuntime,
  resolveSimulatorZip,
} from './ios-evidence-runtime.mjs'
import { collectIosEvidence } from './ios-simulator-evidence.mjs'

const runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-18-0'
const booted = {
  udid: 'A123',
  name: 'iPhone 16',
  state: 'Booted',
  isAvailable: true,
}
const shutdown = {
  udid: 'S456',
  name: 'iPhone 15',
  state: 'Shutdown',
  isAvailable: true,
}

test('scenario picker can take a Shutdown iPhone; dump-only eligibility stays separate', () => {
  const inventory = { devices: { [runtime]: [shutdown] } }
  assert.equal(availableIosSimulators(inventory).length, 1)
  assert.equal(pickSimulatorForScenarios(inventory).udid, 'S456')
  assert.equal(pickSimulatorForScenarios(inventory, 'S456').udid, 'S456')
  assert.throws(() => pickSimulatorForScenarios(inventory, 'missing'), /not available/)
  assert.throws(
    () =>
      pickSimulatorForScenarios({
        devices: {
          [runtime]: [shutdown, { ...shutdown, udid: 'S789', name: 'iPhone 14' }],
        },
      }),
    /--serial/,
  )
  assert.equal(resolveSimulatorZip({ file: '.local-builds/preview.ipa' }), null)
  assert.equal(
    resolveSimulatorZip({ file: '.local-builds/ios/abc/loro-simulator-abc.zip' }, '/repo'),
    '/repo/.local-builds/ios/abc/loro-simulator-abc.zip',
  )
  assert.equal(
    appBundleFromZipListing(['./Loro.app/Info.plist', 'Loro.app/main.jsbundle']),
    'Loro.app',
  )
})

test('execute-scenarios boots a Shutdown simulator and does not reread a Booted one', () => {
  const calls = []
  const run = (tool, args) => {
    calls.push([tool, ...args])
    return { status: 0, stdout: '' }
  }
  assert.deepEqual(ensureSimulatorBooted(run, booted).state, 'Booted')
  assert.deepEqual(calls, [])
  const ready = ensureSimulatorBooted(run, shutdown)
  assert.equal(ready.state, 'Booted')
  assert.deepEqual(calls, [
    ['xcrun', 'simctl', 'boot', 'S456'],
    ['xcrun', 'simctl', 'bootstatus', 'S456', '-b'],
  ])
})

test('installs a verified simulator zip without reading the data container', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-ios-zip-'))
  const zipPath = join(root, 'loro-simulator-abc.zip')
  writeFileSync(zipPath, 'zip-bytes')
  const calls = []
  const run = (tool, args) => {
    calls.push([tool, ...args])
    if (tool === 'unzip' && args.includes('-Z1')) {
      return { status: 0, stdout: 'Loro.app/Info.plist\nLoro.app/main.jsbundle\n' }
    }
    if (tool === 'unzip' && args.includes('-o')) {
      const dest = args[args.indexOf('-d') + 1]
      mkdirSync(join(dest, 'Loro.app'), { recursive: true })
      writeFileSync(join(dest, 'Loro.app', 'Info.plist'), 'plist')
      writeFileSync(join(dest, 'Loro.app', 'main.jsbundle'), 'js')
      return { status: 0, stdout: '' }
    }
    if (args.includes('install')) return { status: 0, stdout: '' }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
  try {
    const installed = installSimulatorZip(run, { udid: 'S456', zipPath, workRoot: root })
    assert.equal(installed.relativeApp, 'Loro.app')
    assert.ok(calls.some((call) => call[0] === 'unzip' && call.includes('-Z1')))
    assert.ok(calls.some((call) => call.includes('install') && call.includes('S456')))
    assert.ok(calls.every((call) => !call.includes('data')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('prepareIosEvidenceRuntime boots, installs a zip, and never asks for the data container', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-ios-prepare-'))
  const zipRel = join('.local-builds', 'ios', 'abc', 'loro-simulator-abc.zip')
  mkdirSync(join(root, '.local-builds', 'ios', 'abc'), { recursive: true })
  writeFileSync(join(root, zipRel), 'zip-bytes')
  const calls = []
  const run = (tool, args) => {
    calls.push([tool, ...args])
    if (tool === 'unzip' && args.includes('-Z1')) {
      return { status: 0, stdout: 'Loro.app/Info.plist\nLoro.app/main.jsbundle\n' }
    }
    if (tool === 'unzip' && args.includes('-o')) {
      const dest = args[args.indexOf('-d') + 1]
      mkdirSync(join(dest, 'Loro.app'), { recursive: true })
      return { status: 0, stdout: '' }
    }
    return { status: 0, stdout: '' }
  }
  try {
    const prepared = prepareIosEvidenceRuntime({
      run,
      inventory: { devices: { [runtime]: [shutdown] } },
      artifact: { file: zipRel },
      rootPath: root,
      workRoot: root,
    })
    assert.equal(prepared.device.udid, 'S456')
    assert.equal(prepared.device.state, 'Booted')
    assert.equal(prepared.installedFromArtifact, true)
    assert.ok(calls.some((call) => call.includes('bootstatus')))
    assert.ok(calls.some((call) => call.includes('install')))
    assert.ok(calls.every((call) => !call.includes('get_app_container') && !call.includes('data')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('collectIosEvidence --execute-scenarios boots, installs the zip, and launches without a data container', () => {
  const output = mkdtempSync(join(tmpdir(), 'loro-ios-collect-'))
  const root = mkdtempSync(join(tmpdir(), 'loro-ios-root-'))
  const zipRel = join('.local-builds', 'ios', 'abc', 'loro-simulator-abc.zip')
  mkdirSync(join(root, '.local-builds', 'ios', 'abc'), { recursive: true })
  writeFileSync(join(root, zipRel), 'zip-bytes')
  const inventory = { devices: { [runtime]: [shutdown] } }
  const calls = []
  const run = (tool, args) => {
    calls.push([tool, ...args])
    if (tool === 'idb') {
      return { status: 1, error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }
    }
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode fixture' }
    if (args.includes('list')) return { status: 0, stdout: JSON.stringify(inventory) }
    if (tool === 'unzip' && args.includes('-Z1')) {
      return { status: 0, stdout: 'Loro.app/Info.plist\nLoro.app/main.jsbundle\n' }
    }
    if (tool === 'unzip' && args.includes('-o')) {
      const dest = args[args.indexOf('-d') + 1]
      mkdirSync(join(dest, 'Loro.app'), { recursive: true })
      return { status: 0, stdout: '' }
    }
    if (args.includes('get_app_container')) {
      assert.equal(args.at(-1), 'app')
      return { status: 0, stdout: '/private/test.app' }
    }
    if (args.includes('screenshot')) {
      writeFileSync(args.at(-1), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      return { status: 0, stdout: '' }
    }
    return { status: 0, stdout: '' }
  }
  try {
    const manifest = collectIosEvidence({
      packageName: 'app.loro.ios',
      output,
      artifactRevision: '26bdd146',
      artifact: { file: zipRel },
      executeScenarios: true,
      rootPath: root,
      run,
    })
    assert.equal(manifest.serial, 'S456')
    assert.equal(manifest.checks.installedFromArtifact, 'yes')
    assert.equal(manifest.checks.launched, 'attempted')
    assert.ok(manifest.scenarios.every((row) => row.status === 'unavailable'))
    assert.ok(calls.some((call) => call.includes('boot') && call.includes('S456')))
    assert.ok(calls.some((call) => call.includes('install')))
    assert.ok(calls.some((call) => call.includes('launch') && call.includes('app.loro.ios')))
    assert.ok(calls.every((call) => !(call.includes('get_app_container') && call.includes('data'))))
  } finally {
    rmSync(output, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
})
