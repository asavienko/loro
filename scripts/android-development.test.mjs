import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateDevelopmentArguments } from './android-development.mjs'

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
