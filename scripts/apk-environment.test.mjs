import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apkBuildEnvironment, posthogFromDotenv } from './apk-environment.mjs'

test('local APK builds ignore an inherited development-client identity', () => {
  const env = apkBuildEnvironment(
    { LORO_ANDROID_DEV_CLIENT: '1', PATH: '/usr/bin' },
    '/Users/test/.cargo/bin',
  )

  assert.equal(env.LORO_LOCAL_APK, '1')
  assert.equal(env.LORO_ANDROID_DEV_CLIENT, undefined)
  assert.equal(env.PATH, '/Users/test/.cargo/bin:/usr/bin')
})

test('the PostHog key and host come from the dotenv file when the shell has none', () => {
  const dotenv = [
    '# PostHog',
    'EXPO_PUBLIC_POSTHOG_KEY=phc_abc',
    'EXPO_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"',
    'ELEVENLABS_API_KEY=secret',
    'EXPO_PUBLIC_API_URL=http://localhost:3000/v1',
  ].join('\n')

  assert.deepEqual(posthogFromDotenv({}, dotenv), {
    EXPO_PUBLIC_POSTHOG_KEY: 'phc_abc',
    EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  })
  assert.deepEqual(posthogFromDotenv({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_shell' }, dotenv), {
    EXPO_PUBLIC_POSTHOG_KEY: 'phc_shell',
    EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  })
  assert.deepEqual(posthogFromDotenv({}, ''), {})
})
