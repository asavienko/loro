import assert from 'node:assert/strict'
import { test } from 'node:test'
import { developmentEnvironment, validateDevelopmentArguments } from './android-development.mjs'

test('allows debug development arguments', () => {
  assert.doesNotThrow(() => validateDevelopmentArguments([]))
  assert.doesNotThrow(() =>
    validateDevelopmentArguments(['--variant', 'debug', '--device', 'Pixel']),
  )
  assert.doesNotThrow(() => validateDevelopmentArguments(['--variant=debug']))
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

test('removes the standalone Preview flag from development subprocesses', () => {
  const env = developmentEnvironment({ LORO_LOCAL_APK: '1', PATH: '/usr/bin' })

  assert.equal(env.LORO_LOCAL_APK, undefined)
  assert.equal(env.LORO_ANDROID_DEV_CLIENT, '1')
  assert.equal(env.PATH, '/usr/bin')
})
