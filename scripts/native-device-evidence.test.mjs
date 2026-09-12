import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  artifactIdentity,
  collectLogcat,
  defaultPackage,
  evidenceOutput,
  parseArguments,
} from './native-device-evidence.mjs'
import { collectIosEvidence, selectSimulator } from './ios-simulator-evidence.mjs'
import { unevaluatedWaveScenarios, WAVE_TOUCH_SCENARIOS } from './wave-touch-scenarios.mjs'

test('logcat ENOBUFS stays unavailable and does not abort the wave rows', () => {
  const result = collectLogcat('adb', 'emulator-5554', () => ({
    error: Object.assign(new Error('ENOBUFS'), { code: 'ENOBUFS' }),
  }))
  assert.equal(result.status, 'unavailable')
  assert.match(result.text, /ENOBUFS/)
})

test('uses the preview package and accepts bounded device options', () => {
  assert.deepEqual(parseArguments([]), {
    platform: 'android',
    packageName: defaultPackage,
    serial: undefined,
    output: undefined,
    artifactRevision: undefined,
    artifact: undefined,
    executeScenarios: false,
  })
  assert.deepEqual(parseArguments(['--serial', 'R5CT1234', '--package', 'app.loro.android']), {
    platform: 'android',
    packageName: 'app.loro.android',
    serial: 'R5CT1234',
    output: undefined,
    artifactRevision: undefined,
    artifact: undefined,
    executeScenarios: false,
  })
  assert.equal(parseArguments(['--execute-scenarios']).executeScenarios, true)
})

test('rejects unsafe adb values and output outside local artifacts', () => {
  assert.throws(() => parseArguments(['--serial', 'device;rm']), /unsupported characters/)
  assert.throws(() => parseArguments(['--package', 'not-a-package']), /application identifier/)
  assert.throws(
    () => parseArguments(['--artifact-revision', 'not a revision']),
    /Artifact revision/,
  )
  assert.throws(() => evidenceOutput('/repo', '/tmp/evidence'), /must remain inside/)
})

test('keeps requested evidence nested below the ignored artifact directory', () => {
  assert.equal(
    evidenceOutput('/repo', '/repo/.local-builds/native-evidence/device-run'),
    '/repo/.local-builds/native-evidence/device-run',
  )
})

test('binds evidence to retained artifact bytes and rejects paths outside local builds', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-native-evidence-'))
  try {
    const builds = join(root, '.local-builds')
    mkdirSync(builds)
    const artifact = join(builds, 'preview.apk')
    writeFileSync(artifact, 'retained build bytes')
    assert.deepEqual(artifactIdentity(root, '26bdd146', artifact), {
      revision: '26bdd146',
      file: '.local-builds/preview.apk',
      sha256: '619096ee1e9fd24fb9d2a779439fb1343aa5a546273ed99cc55307ed63fa37ff',
      bytes: 20,
    })
    assert.throws(() => artifactIdentity(root, '26bdd146', join(root, 'outside.apk')), /inside/)
    assert.throws(() => artifactIdentity(root, '26bdd146', builds), /regular file/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const simulator = { udid: 'A123', name: 'iPhone', state: 'Booted', isAvailable: true }
const inventory = { devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [simulator] } }

test('iOS CLI selects its bundle default regardless of option order', () => {
  assert.equal(parseArguments(['--platform', 'ios']).packageName, 'app.loro.ios')
  assert.equal(
    parseArguments(['--package', 'app.test.ios', '--platform', 'ios']).packageName,
    'app.test.ios',
  )
  assert.throws(() => parseArguments(['--platform', 'macos']), /Platform/)
})

test('captures a bounded retained artifact revision', () => {
  assert.equal(parseArguments(['--artifact-revision', '26bdd146']).artifactRevision, '26bdd146')
})

test('lists plan 101 wave-path rows without treating a screenshot as a pass', () => {
  assert.equal(parseArguments(['--list-scenarios']).listScenarios, true)
  assert.deepEqual(
    WAVE_TOUCH_SCENARIOS.map((row) => row.id),
    ['stream-to-phrase-refrain', 'menu-hard-refrain', 'practice-back-swipe-disabled'],
  )
  const rows = unevaluatedWaveScenarios('no device')
  assert.ok(rows.every((row) => row.status === 'unavailable' && row.reason === 'no device'))
})

test('iOS collection requires an unambiguous available booted simulator', () => {
  assert.equal(selectSimulator(inventory).udid, 'A123')
  assert.throws(() => selectSimulator({ devices: {} }), /Boot one/)
  const multiple = {
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [simulator, { ...simulator, udid: 'B456' }],
    },
  }
  assert.throws(() => selectSimulator(multiple), /select one/)
  assert.equal(selectSimulator(multiple, 'B456').udid, 'B456')
  assert.throws(() => selectSimulator(inventory, 'missing'), /available and booted/)
  assert.throws(
    () =>
      selectSimulator({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [{ ...simulator, state: 'Shutdown' }],
        },
      }),
    /Boot one/,
  )
})

test('iOS collection retains actual artifacts without copying app containers or claiming acceptance', () => {
  const output = mkdtempSync(join(tmpdir(), 'loro-ios-evidence-'))
  const calls = []
  const run = (tool, args) => {
    calls.push([tool, ...args])
    let stdout = ''
    if (tool === 'xcodebuild') stdout = 'Xcode fixture'
    else if (args.includes('list')) stdout = JSON.stringify(inventory)
    else if (args.includes('get_app_container')) stdout = '/private/test.app'
    else if (args.includes('screenshot'))
      writeFileSync(args.at(-1), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    else assert.fail('Unexpected command')
    return { status: 0, stdout }
  }
  try {
    const artifact = {
      revision: '26bdd146',
      file: '.local-builds/preview.ipa',
      sha256: 'a'.repeat(64),
      bytes: 20,
    }
    const manifest = collectIosEvidence({
      packageName: 'app.loro.ios',
      output,
      artifactRevision: '26bdd146',
      artifact,
      run,
    })
    assert.equal(manifest.deviceKind, 'simulator')
    assert.equal(manifest.artifactRevision, '26bdd146')
    assert.deepEqual(manifest.artifact, artifact)
    assert.ok(manifest.scenarios.every((row) => row.status === 'unavailable'))
    assert.ok(manifest.scenarios.some((row) => row.id === 'stream-to-phrase-refrain'))
    const driven = collectIosEvidence({
      packageName: 'app.loro.ios',
      output: join(output, 'driven'),
      artifactRevision: '26bdd146',
      artifact,
      executeScenarios: true,
      run,
    })
    assert.ok(driven.scenarios.every((row) => row.status === 'unavailable'))
    assert.ok(driven.scenarios.every((row) => row.reason.includes('iOS --execute-scenarios')))
    assert.deepEqual(JSON.parse(readFileSync(join(output, 'manifest.json'))), manifest)
    assert.deepEqual(calls[2], [
      'xcrun',
      'simctl',
      'get_app_container',
      'A123',
      'app.loro.ios',
      'app',
    ])
    assert.equal(calls.length, 8)
    assert.equal(readFileSync(join(output, 'device.json'), 'utf8').includes('/private'), false)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})

test('missing Xcode fails explicitly without leaking subprocess output', () => {
  assert.throws(
    () => collectIosEvidence({ run: () => ({ status: 1, stderr: 'sensitive fixture' }) }),
    (error) => error.message.includes('Full Xcode') && !error.message.includes('sensitive fixture'),
  )
})

test('unavailable and non-iOS runtimes cannot supply iOS evidence', () => {
  assert.throws(
    () =>
      selectSimulator({ devices: { 'com.apple.CoreSimulator.SimRuntime.tvOS-18-0': [simulator] } }),
    /Boot one/,
  )
  assert.throws(
    () =>
      selectSimulator({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [{ ...simulator, isAvailable: false }],
        },
      }),
    /Boot one/,
  )
})

test('missing installed app stops before collecting artifacts', () => {
  let calls = 0
  assert.throws(
    () =>
      collectIosEvidence({
        packageName: 'app.loro.ios',
        run: (tool, args) => {
          calls += 1
          if (args.includes('get_app_container')) return { status: 1 }
          return {
            status: 0,
            stdout: tool === 'xcodebuild' ? 'Xcode fixture' : JSON.stringify(inventory),
          }
        },
      }),
    /installed app/,
  )
  assert.equal(calls, 3)
})
