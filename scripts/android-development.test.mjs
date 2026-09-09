import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { developmentEnvironment, validateDevelopmentArguments } from './android-development.mjs'

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/mobile')

test('allows debug development arguments', () => {
  assert.doesNotThrow(() => validateDevelopmentArguments([]))
  assert.doesNotThrow(() =>
    validateDevelopmentArguments(['--variant', 'debug', '--device', 'Pixel']),
  )
  assert.doesNotThrow(() => validateDevelopmentArguments(['--variant=debug']))
  assert.doesNotThrow(() => validateDevelopmentArguments(['--device', '--no-bundler']))
  assert.doesNotThrow(() => validateDevelopmentArguments(['-d', 'Pixel 8', '-p', '8082']))
  assert.doesNotThrow(() => validateDevelopmentArguments(['--device=Pixel', '--port=8082']))
})

test('rejects project overrides without confusing option values with projects', () => {
  for (const args of [
    ['/tmp/another-mobile'],
    ['../another-mobile'],
    ['--device', 'Pixel', '../another-mobile'],
    ['--port=8082', '../another-mobile'],
    ['--', '../another-mobile'],
    ['--unknown'],
    ['--no-install=true'],
  ]) {
    assert.throws(() => validateDevelopmentArguments(args), /Project overrides are not supported/)
  }
  assert.throws(() => validateDevelopmentArguments(['--port']), /Missing value/)
  assert.throws(() => validateDevelopmentArguments(['--port', '../another-mobile']), /port must/)
})

test('rejects release variants before synchronizing a development project', () => {
  assert.throws(
    () => validateDevelopmentArguments(['--variant', 'release']),
    /supports only the debug variant.*pnpm apk:local/,
  )
  assert.throws(
    () => validateDevelopmentArguments(['--variant=release']),
    /supports only the debug variant.*pnpm apk:local/,
  )
  assert.throws(
    () => validateDevelopmentArguments(['--variant']),
    /supports only the debug variant.*pnpm apk:local/,
  )
})

test('rejects custom APKs before synchronizing a development project', () => {
  assert.throws(
    () => validateDevelopmentArguments(['--binary', '/tmp/loro-preview.apk']),
    /builds and launches Loro Development only.*pnpm apk:local/,
  )
  assert.throws(
    () => validateDevelopmentArguments(['--binary=/tmp/loro-preview.apk']),
    /builds and launches Loro Development only.*pnpm apk:local/,
  )
})

test('rejects custom Android app IDs before synchronizing a development project', () => {
  assert.throws(
    () => validateDevelopmentArguments(['--app-id', 'app.loro.android.preview']),
    /owns the Loro Development app ID.*pnpm apk:local/,
  )
  assert.throws(
    () => validateDevelopmentArguments(['--app-id=app.loro.android.preview']),
    /owns the Loro Development app ID.*pnpm apk:local/,
  )
  assert.throws(
    () => validateDevelopmentArguments(['--app-id']),
    /owns the Loro Development app ID.*pnpm apk:local/,
  )
})

test('forces the development identity in subprocesses', () => {
  const env = developmentEnvironment({ LORO_LOCAL_APK: '1', PATH: '/usr/bin' })

  assert.equal(env.LORO_LOCAL_APK, '0')
  assert.equal(env.LORO_ANDROID_DEV_CLIENT, '1')
  assert.equal(env.PATH, '/usr/bin')
})

test('keeps the development identity when Expo loads a Preview dotenv value', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'loro-android-development-'))
  try {
    writeFileSync(
      join(fixtureRoot, '.env'),
      'LORO_LOCAL_APK=1\nEXPO_PUBLIC_ANDROID_REVIEW_SENTINEL=loaded\n',
    )
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `
          const { load } = require('@expo/env')
          const { getConfig } = require('@expo/config')
          load(${JSON.stringify(fixtureRoot)}, { force: true, silent: true })
          const config = getConfig(${JSON.stringify(mobileRoot)}, {
            skipSDKVersionRequirement: true,
          }).exp
          process.stdout.write(JSON.stringify({
            localApk: process.env.LORO_LOCAL_APK,
            sentinel: process.env.EXPO_PUBLIC_ANDROID_REVIEW_SENTINEL,
            package: config.android.package,
            scheme: config.scheme,
            nativeRedirectUri: config.extra.nativeRedirectUri,
          }))
        `,
      ],
      {
        cwd: mobileRoot,
        encoding: 'utf8',
        env: developmentEnvironment({ NODE_ENV: 'development', PATH: process.env.PATH }),
      },
    )

    assert.equal(child.status, 0, child.stderr)
    assert.deepEqual(JSON.parse(child.stdout), {
      localApk: '0',
      sentinel: 'loaded',
      package: 'app.loro.android.dev',
      scheme: 'loro-dev',
      nativeRedirectUri: 'loro-dev://account',
    })
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true })
  }
})
