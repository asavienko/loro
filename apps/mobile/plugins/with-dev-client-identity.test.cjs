const assert = require('node:assert/strict')
const { test } = require('node:test')

const { applyDebugIdentity } = require('./with-dev-client-identity.cjs')

const buildGradle = `android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`

test('gives only the Android debug variant a Metro-dependent development identity', () => {
  const result = applyDebugIdentity(buildGradle)

  assert.match(result, /applicationIdSuffix "\.dev"/)
  assert.match(result, /resValue "string", "app_name", "Loro Development"/)
  assert.match(result, /Loro development client: Metro is required/)
  assert.equal(applyDebugIdentity(result), result)
})

test('fails if Expo changes the generated debug build-type shape', () => {
  assert.throws(
    () => applyDebugIdentity('android { buildTypes { release { } } }'),
    /Unable to find Android debug build type/,
  )
})
