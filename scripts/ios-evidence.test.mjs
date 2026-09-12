import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  executeIosEvidence,
  parseIosEvidenceArguments,
  retainedIosSimulatorZip,
} from './ios-evidence.mjs'

const sha = 'd0585dab4ce179c4cd3a636445db587d09f55d82'

test('retains evidence under .local-builds/ios/<commit> and native-evidence', () => {
  const planned = retainedIosSimulatorZip('/workspace', sha)
  assert.equal(planned.short, 'd0585dab4ce1')
  assert.equal(planned.zipName, 'loro-simulator-d0585dab4ce1.zip')
  assert.equal(
    planned.relativeZip,
    '.local-builds/ios/d0585dab4ce1/loro-simulator-d0585dab4ce1.zip',
  )
  assert.equal(planned.bundleId, 'app.loro.ios')
})

test('parses skip-build, serial, and output', () => {
  assert.deepEqual(parseIosEvidenceArguments([]), {
    skipBuild: false,
    serial: undefined,
    output: undefined,
    help: false,
  })
  assert.deepEqual(
    parseIosEvidenceArguments(['--skip-build', '--serial', 'S456', '--output', 'out']),
    {
      skipBuild: true,
      serial: 'S456',
      output: 'out',
      help: false,
    },
  )
  assert.throws(() => parseIosEvidenceArguments(['--serial']), /UDID/)
  assert.throws(() => parseIosEvidenceArguments(['--unknown']), /Unknown/)
})

test('Linux never builds or collects iOS wave-path evidence', () => {
  assert.throws(
    () =>
      executeIosEvidence({
        platform: 'linux',
        run: () => assert.fail('should not invoke Xcode on Linux'),
        build: () => assert.fail('should not build on Linux'),
        collect: () => assert.fail('should not collect on Linux'),
      }),
    /macOS and full Xcode/,
  )
})

test('skip-build without a retained zip fails closed', () => {
  const darwin = (tool) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\n' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-ios-sim\n' }
    if (tool === 'git') return { status: 0, stdout: `${sha}\n` }
    assert.fail(`unexpected ${tool}`)
  }
  assert.throws(
    () =>
      executeIosEvidence({
        platform: 'darwin',
        arch: 'arm64',
        skipBuild: true,
        run: darwin,
        exists: () => false,
        build: () => assert.fail('skip-build must not compile'),
        collect: () => assert.fail('missing zip must not collect'),
      }),
    /ios:local first/,
  )
})

test('reuses a retained zip, binds its bytes, and drives execute-scenarios', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-ios-evidence-'))
  const planned = retainedIosSimulatorZip(root, sha)
  mkdirSync(planned.directory, { recursive: true })
  writeFileSync(planned.zipPath, 'simulator-zip-bytes')
  const built = []
  const collected = []
  const run = (tool) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\n' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-ios-sim\n' }
    if (tool === 'git') return { status: 0, stdout: `${sha}\n` }
    assert.fail(`unexpected ${tool}`)
  }
  try {
    const manifest = executeIosEvidence({
      rootPath: root,
      platform: 'darwin',
      arch: 'arm64',
      serial: 'S456',
      run,
      build: () => {
        built.push('built')
        return { artifact: planned.relativeZip }
      },
      collect: (options) => {
        collected.push(options)
        return {
          packageName: options.packageName,
          serial: options.serial,
          scenarios: [{ id: 'stream-to-phrase-refrain', status: 'unavailable' }],
        }
      },
    })
    assert.deepEqual(built, [])
    assert.equal(collected.length, 1)
    assert.equal(collected[0].executeScenarios, true)
    assert.equal(collected[0].serial, 'S456')
    assert.equal(collected[0].packageName, 'app.loro.ios')
    assert.equal(collected[0].artifactRevision, sha)
    assert.equal(collected[0].artifact.file, planned.relativeZip)
    assert.equal(collected[0].artifact.bytes, 19)
    assert.match(collected[0].output, /wave-101-ios-d0585dab4ce1$/)
    assert.equal(manifest.serial, 'S456')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('missing zip asks ios:local to compile once, then collects', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-ios-evidence-build-'))
  const planned = retainedIosSimulatorZip(root, sha)
  let existsCalls = 0
  const run = (tool) => {
    if (tool === 'xcodebuild') return { status: 0, stdout: 'Xcode 16.4\n' }
    if (tool === 'pod') return { status: 0, stdout: '1.16.2' }
    if (tool === 'rustup') return { status: 0, stdout: 'aarch64-apple-ios-sim\n' }
    if (tool === 'git') return { status: 0, stdout: `${sha}\n` }
    assert.fail(`unexpected ${tool}`)
  }
  try {
    executeIosEvidence({
      rootPath: root,
      platform: 'darwin',
      arch: 'arm64',
      run,
      exists: (path) => {
        existsCalls += 1
        return existsCalls > 1 && path === planned.zipPath
      },
      build: ({ install }) => {
        assert.equal(install, false)
        mkdirSync(planned.directory, { recursive: true })
        writeFileSync(planned.zipPath, 'built-zip')
        return { artifact: planned.relativeZip }
      },
      collect: (options) => {
        assert.equal(options.executeScenarios, true)
        assert.equal(options.artifact.file, planned.relativeZip)
        return { packageName: 'app.loro.ios', serial: 'A123' }
      },
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
