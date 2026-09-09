import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apkBuildEnvironment } from './apk-environment.mjs'

test('local APK builds ignore an inherited development-client identity', () => {
  const env = apkBuildEnvironment(
    { LORO_ANDROID_DEV_CLIENT: '1', PATH: '/usr/bin' },
    '/Users/test/.cargo/bin',
  )

  assert.equal(env.LORO_LOCAL_APK, '1')
  assert.equal(env.LORO_ANDROID_DEV_CLIENT, undefined)
  assert.equal(env.PATH, '/Users/test/.cargo/bin:/usr/bin')
})
