const assert = require('node:assert/strict')
const { test } = require('node:test')

const { applyDebugIdentity, replaceLoroSchemes } = require('./with-dev-client-identity.cjs')

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

test('replaces only Loro-owned Android schemes when prebuild reuses a native project', () => {
  const manifest = {
    manifest: {
      application: [
        {
          activity: [
            {
              $: { 'android:launchMode': 'singleTask' },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
                  category: [
                    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                    { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
                  ],
                  data: [
                    { $: { 'android:scheme': 'loro' } },
                    { $: { 'android:scheme': 'loro-dev' } },
                    { $: { 'android:scheme': 'unrelated' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }

  const result = replaceLoroSchemes(manifest, 'loro-dev')
  const data = result.manifest.application[0].activity[0]['intent-filter'][0].data
    .filter(Boolean)
    .map((entry) => entry.$['android:scheme'])

  assert.deepEqual(data.sort(), ['loro-dev', 'unrelated'])
})
