const assert = require('node:assert/strict')
const { test } = require('node:test')
const { getConfig } = require('@expo/config')

const mobileRoot = require('node:path').resolve(__dirname, '..')

function configFor(environment) {
  const saved = {
    LORO_ANDROID_DEV_CLIENT: process.env.LORO_ANDROID_DEV_CLIENT,
    LORO_LOCAL_APK: process.env.LORO_LOCAL_APK,
  }
  try {
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    return getConfig(mobileRoot, { skipSDKVersionRequirement: true }).exp
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('uses separate callback identities for development and Preview Android builds', () => {
  const development = configFor({ LORO_ANDROID_DEV_CLIENT: '1', LORO_LOCAL_APK: undefined })
  const preview = configFor({ LORO_ANDROID_DEV_CLIENT: '1', LORO_LOCAL_APK: '1' })

  assert.equal(development.android.package, 'app.loro.android')
  assert.equal(development.scheme, 'loro-dev')
  assert.equal(development.extra.nativeRedirectUri, 'loro-dev://account')
  assert.equal(preview.android.package, 'app.loro.android.preview')
  assert.equal(preview.scheme, 'loro')
  assert.equal(preview.extra.nativeRedirectUri, 'loro://account')
})
