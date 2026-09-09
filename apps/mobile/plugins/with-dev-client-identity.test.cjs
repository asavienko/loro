const assert = require('node:assert/strict')
const { test } = require('node:test')
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createRequire } = require('node:module')

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

test('migrates the old suffix and lets a fresh Expo launcher resolve Development', async () => {
  const legacy = applyDebugIdentity(buildGradle)
  const development = applyDebugIdentity(legacy, true)
  assert.doesNotMatch(development, /applicationIdSuffix/)
  assert.equal(applyDebugIdentity(development, true), development)
  assert.equal(applyDebugIdentity(development, false), legacy)
  const fixture = mkdtempSync(join(tmpdir(), 'loro-launch-identity-'))
  try {
    mkdirSync(join(fixture, 'android/app'), { recursive: true })
    writeFileSync(
      join(fixture, 'android/app/build.gradle'),
      development.replace(
        'android {',
        'android {\n defaultConfig { applicationId "app.loro.android.dev" }',
      ),
    )
    const cli = createRequire(require.resolve('@expo/cli/package.json'))
    const { AndroidAppIdResolver } = cli(
      './build/src/start/platforms/android/AndroidAppIdResolver.js',
    )
    const { AndroidPlatformManager } = cli(
      './build/src/start/platforms/android/AndroidPlatformManager.js',
    )
    const resolver = new AndroidAppIdResolver(fixture)
    assert.equal(await resolver.getAppIdFromNativeAsync(), 'app.loro.android.dev')
    const launched = []
    const manager = new AndroidPlatformManager(fixture, 8081, { getCustomRuntimeUrl: () => null })
    manager.props.resolveDeviceAsync = async () => ({
      isAppInstalledAndIfSoReturnContainerPathForIOSAsync: async (id) =>
        id === 'app.loro.android.dev',
      logOpeningUrl: () => {},
      activateWindowAsync: async () => {},
      openUrlAsync: async (url, options) => launched.push({ url, ...options }),
    })
    await manager.openProjectInCustomRuntimeWithCustomAppIdAsync({ runtime: 'custom' }, {})
    assert.deepEqual(launched, [
      { url: 'app.loro.android.dev/.MainActivity', appId: 'app.loro.android.dev' },
    ])
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
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
