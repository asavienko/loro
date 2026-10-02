import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  appStoreConnectAuth,
  buildNumber,
  exportOptionsPlist,
  ipaBuildEnvironment,
  parseIpaArgs,
  previewBundleId,
  publicUrls,
  teamId,
} from './ipa-environment.mjs'

test('a device build defaults to a development export', () => {
  assert.deepEqual(parseIpaArgs([]), {
    export: 'development',
    simulator: false,
    install: false,
    device: '',
    team: '',
  })
  assert.equal(parseIpaArgs(['--export', 'ad-hoc', '--team', 'ABCDE12345']).team, 'ABCDE12345')
  assert.equal(parseIpaArgs(['--install', '--device', 'UDID']).device, 'UDID')
  assert.deepEqual(parseIpaArgs(['--help', '--nonsense']), { help: true })
})

test('options that cannot work together are refused', () => {
  assert.throws(() => parseIpaArgs(['--export', 'app-store']), /must be one of/)
  assert.throws(() => parseIpaArgs(['--export']), /needs a value/)
  assert.throws(() => parseIpaArgs(['--team', '--simulator']), /needs a value/)
  assert.throws(() => parseIpaArgs(['--simulator', '--export', 'ad-hoc']), /unsigned/)
  assert.throws(() => parseIpaArgs(['--simulator', '--team', 'ABCDE12345']), /unsigned/)
  assert.throws(() => parseIpaArgs(['--device', 'UDID']), /used with --install/)
  assert.throws(() => parseIpaArgs(['--install']), /needs --device/)
  assert.throws(
    () => parseIpaArgs(['--export', 'testflight', '--install', '--device', 'UDID']),
    /TestFlight app/,
  )
  assert.throws(() => parseIpaArgs(['--upload']), /Unknown option/)
  assert.equal(parseIpaArgs(['--simulator', '--install']).install, true)
})

test('the team comes from the option, else APPLE_TEAM_ID, and must look like one', () => {
  assert.equal(teamId('ABCDE12345', { APPLE_TEAM_ID: 'ZZZZZ99999' }), 'ABCDE12345')
  assert.equal(teamId('', { APPLE_TEAM_ID: 'ZZZZZ99999' }), 'ZZZZZ99999')
  assert.throws(() => teamId('', {}), /Name the Apple team/)
  assert.throws(() => teamId('abc', {}), /10 capital letters/)
})

test('a preview build has its own identifier, which a personal team may replace', () => {
  assert.equal(previewBundleId({}), 'app.loro.ios.preview')
  assert.equal(previewBundleId({ LORO_IOS_BUNDLE_ID: 'com.example.loro' }), 'com.example.loro')
  assert.throws(() => previewBundleId({ LORO_IOS_BUNDLE_ID: 'loro' }), /reverse-DNS/)
  assert.throws(() => previewBundleId({ LORO_IOS_BUNDLE_ID: 'com.example/loro' }), /reverse-DNS/)
})

test('the build number is the commit count unless one is given', () => {
  assert.equal(buildNumber({}, '412'), '412')
  assert.equal(buildNumber({ LORO_IOS_BUILD_NUMBER: '413.1' }, '412'), '413.1')
  assert.throws(() => buildNumber({ LORO_IOS_BUILD_NUMBER: 'v2' }, '412'), /integers/)
  assert.throws(() => buildNumber({}, '0'), /integers/)
})

test('the environment picks the iOS identity and drops inherited Android ones', () => {
  const inherited = {
    PATH: '/usr/bin',
    LORO_LOCAL_APK: '1',
    LORO_ANDROID_DEV_CLIENT: '1',
    LORO_LOCAL_IPA: '1',
    LORO_IOS_BUNDLE_ID: 'com.example.stale',
  }
  const preview = ipaBuildEnvironment(inherited, '/Users/test/.cargo/bin', {
    identity: 'preview',
    bundleId: 'app.loro.ios.preview',
    build: '412',
  })
  assert.equal(preview.LORO_LOCAL_IPA, '1')
  assert.equal(preview.LORO_IOS_BUNDLE_ID, 'app.loro.ios.preview')
  assert.equal(preview.LORO_IOS_BUILD_NUMBER, '412')
  assert.equal(preview.LORO_LOCAL_APK, undefined)
  assert.equal(preview.LORO_ANDROID_DEV_CLIENT, undefined)
  assert.equal(preview.PATH, '/Users/test/.cargo/bin:/usr/bin')

  const store = ipaBuildEnvironment(inherited, '/c', {
    identity: 'store',
    bundleId: 'app.loro.ios',
    build: '412',
  })
  assert.equal(store.LORO_LOCAL_IPA, undefined)
  assert.equal(store.LORO_IOS_BUNDLE_ID, undefined)
})

test('the API and web URLs are checked as the APK runner checks them', () => {
  assert.deepEqual(publicUrls({}), { api: '', web: '' })
  assert.deepEqual(
    publicUrls({
      EXPO_PUBLIC_API_URL: 'https://api.example/v1',
      EXPO_PUBLIC_WEB_URL: 'https://w.example',
    }),
    { api: 'https://api.example/v1', web: 'https://w.example' },
  )
  assert.throws(() => publicUrls({ EXPO_PUBLIC_API_URL: 'http://api.example/v1' }), /HTTPS/)
  assert.throws(() => publicUrls({ EXPO_PUBLIC_API_URL: 'https://api.example/' }), /end in \/v1/)
  assert.throws(() => publicUrls({ EXPO_PUBLIC_API_URL: 'https://u:p@api.example/v1' }), /HTTPS/)
  assert.throws(() => publicUrls({ EXPO_PUBLIC_WEB_URL: 'https://w.example/?a=1' }), /HTTPS/)
})

test('the App Store Connect key is passed whole or not at all', () => {
  assert.deepEqual(appStoreConnectAuth({}), [])
  assert.deepEqual(
    appStoreConnectAuth({
      APP_STORE_CONNECT_API_KEY_PATH: '/k/AuthKey.p8',
      APP_STORE_CONNECT_API_KEY_ID: 'KEY',
      APP_STORE_CONNECT_API_ISSUER_ID: 'ISSUER',
    }),
    [
      '-authenticationKeyPath',
      '/k/AuthKey.p8',
      '-authenticationKeyID',
      'KEY',
      '-authenticationKeyIssuerID',
      'ISSUER',
    ],
  )
  assert.throws(() => appStoreConnectAuth({ APP_STORE_CONNECT_API_KEY_ID: 'KEY' }), /or none/)
})

test('export options sign automatically, and only TestFlight uploads', () => {
  const adHoc = exportOptionsPlist({ method: 'release-testing', team: 'ABCDE12345', upload: false })
  assert.match(adHoc, /<key>method<\/key>\n\t<string>release-testing<\/string>/)
  assert.match(adHoc, /<key>teamID<\/key>\n\t<string>ABCDE12345<\/string>/)
  assert.match(adHoc, /<key>signingStyle<\/key>\n\t<string>automatic<\/string>/)
  assert.match(adHoc, /<key>destination<\/key>\n\t<string>export<\/string>/)
  assert.match(adHoc, /<string>&lt;none&gt;<\/string>/)
  assert.doesNotMatch(adHoc, /manageAppVersionAndBuildNumber/)

  const upload = exportOptionsPlist({
    method: 'app-store-connect',
    team: 'ABCDE12345',
    upload: true,
  })
  assert.match(upload, /<key>destination<\/key>\n\t<string>upload<\/string>/)
  assert.match(upload, /<key>manageAppVersionAndBuildNumber<\/key>\n\t<false\/>/)
})
