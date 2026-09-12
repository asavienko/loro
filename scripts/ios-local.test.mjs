import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  executeIosLocalBuild,
  findSimulatorApp,
  iosLocalOutput,
  probeIosLocalHost,
  requiredIosRustTargets,
  verifyIosSimulatorZip,
} from './ios-local.mjs'

test('requires the Apple-silicon or Intel simulator Rust target', () => {
  assert.deepEqual(requiredIosRustTargets('arm64'), ['aarch64-apple-ios-sim'])
  assert.deepEqual(requiredIosRustTargets('x64'), ['x86_64-apple-ios'])
})

test('retains the simulator zip under .local-builds/ios/<commit>', () => {
  const planned = iosLocalOutput('/workspace', 'd0585dab4ce179c4cd3a636445db587d09f55d82')
  assert.equal(planned.short, 'd0585dab4ce1')
  assert.equal(planned.directory, '/workspace/.local-builds/ios/d0585dab4ce1')
  assert.equal(planned.zipName, 'loro-simulator-d0585dab4ce1.zip')
  assert.equal(planned.bundleId, 'app.loro.ios')
})

test('Linux and missing Xcode never produce an iOS artifact', () => {
  const linux = probeIosLocalHost({
    platform: 'linux',
    run: () => assert.fail('should not invoke Xcode on Linux'),
  })
  assert.match(linux.reason, /macOS and full Xcode/)

  const missingXcode = probeIosLocalHost({
    platform: 'darwin',
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.match(missingXcode.reason, /Full Xcode/)
})

test('missing CocoaPods or the iOS simulator Rust target fail closed', () => {
  const run = (tool, args) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\n' }
    if (tool === 'pod') return { status: 1, stderr: 'pod missing' }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
  assert.match(probeIosLocalHost({ platform: 'darwin', run }).reason, /CocoaPods/)

  const rust = (tool) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\n' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-darwin\n' }
    assert.fail(`unexpected ${tool}`)
  }
  assert.match(
    probeIosLocalHost({ platform: 'darwin', arch: 'arm64', run: rust }).reason,
    /aarch64-apple-ios-sim/,
  )
})

test('probe passes only when Xcode, CocoaPods, and the simulator Rust target exist', () => {
  const run = (tool) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\nBuild version 16F6\n' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-ios-sim\n' }
    assert.fail(`unexpected ${tool}`)
  }
  const probe = probeIosLocalHost({ platform: 'darwin', arch: 'arm64', run })
  assert.equal(probe.ok, true)
  assert.match(probe.xcode, /Xcode 16/)
})

test('simulator zip verification requires the app plist and JS bundle', () => {
  assert.equal(verifyIosSimulatorZip(['Loro.app/']).status, 'failed')
  assert.equal(verifyIosSimulatorZip(['Loro.app/Info.plist']).status, 'failed')
  assert.equal(
    verifyIosSimulatorZip(['Loro.app/Info.plist', 'Loro.app/main.jsbundle']).status,
    'passed',
  )
  assert.equal(
    verifyIosSimulatorZip(['./Loro.app/Info.plist', './Loro.app/index.ios.bundle']).status,
    'passed',
  )
})

test('finds exactly one Release-iphonesimulator app', () => {
  assert.equal(
    findSimulatorApp('/derived/Release-iphonesimulator', () => ['Loro.app', 'Pods_Loro.framework']),
    '/derived/Release-iphonesimulator/Loro.app',
  )
  assert.throws(
    () => findSimulatorApp('/derived/Release-iphonesimulator', () => ['Loro.app', 'Loro.dev.app']),
    /exactly one/,
  )
})

test('executeIosLocalBuild fail-closes on Linux and on a dirty tree', () => {
  assert.throws(
    () =>
      executeIosLocalBuild({
        platform: 'linux',
        nodeMajor: '22',
        env: {},
        run: () => assert.fail('should not build on Linux'),
      }),
    /macOS and full Xcode/,
  )
  assert.throws(
    () =>
      executeIosLocalBuild({
        platform: 'darwin',
        arch: 'arm64',
        nodeMajor: '22',
        env: { GITHUB_ACTIONS: '1' },
        run: () => ({ status: 0, stdout: '' }),
      }),
    /GitHub Actions is disabled/,
  )
  const dirty = (tool, args) => {
    if (tool === 'xcodebuild' && args.includes('-version')) return { status: 0, stdout: 'Xcode 16' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-ios-sim\n' }
    if (tool === 'git' && args.includes('status')) return { status: 0, stdout: ' M scripts/foo.mjs' }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
  assert.throws(
    () =>
      executeIosLocalBuild({
        platform: 'darwin',
        arch: 'arm64',
        nodeMajor: '22',
        env: {},
        run: dirty,
      }),
    /Commit or stash/,
  )
})
