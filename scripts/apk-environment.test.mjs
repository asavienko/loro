import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  apkBuildEnvironment,
  resolveAdb,
  resolveAndroidHome,
  resolveJavaHome,
} from './apk-environment.mjs'

test('local APK builds ignore an inherited development-client identity', () => {
  const env = apkBuildEnvironment(
    { LORO_ANDROID_DEV_CLIENT: '1', PATH: '/usr/bin' },
    '/Users/test/.cargo/bin',
    () => false,
    '/home/builder',
  )

  assert.equal(env.LORO_LOCAL_APK, '1')
  assert.equal(env.LORO_ANDROID_DEV_CLIENT, undefined)
  assert.equal(env.ANDROID_HOME, join('/home/builder', 'Library/Android/sdk'))
  assert.match(env.PATH, /\/Users\/test\/\.cargo\/bin/)
  assert.match(env.PATH, /\/usr\/bin/)
})

test('resolves Linux JDK 17 and Android SDK when those tools are installed', () => {
  const home = '/home/builder'
  const linuxJdk = '/usr/lib/jvm/java-17-openjdk-amd64'
  const linuxSdk = join(home, 'Android/Sdk')
  const exists = (path) =>
    path === join(linuxJdk, 'bin/java') ||
    path === join(linuxSdk, 'platform-tools') ||
    path === join(linuxSdk, 'platform-tools/adb')

  assert.equal(resolveJavaHome({}, exists, home), linuxJdk)
  assert.equal(resolveAndroidHome({}, exists, home), linuxSdk)
  assert.equal(resolveAdb({}, exists, home), join(linuxSdk, 'platform-tools/adb'))

  const env = apkBuildEnvironment({ PATH: '/usr/bin' }, '/home/builder/.cargo/bin', exists, home)
  assert.equal(env.JAVA_HOME, linuxJdk)
  assert.equal(env.ANDROID_HOME, linuxSdk)
  assert.equal(env.ANDROID_SDK_ROOT, linuxSdk)
  assert.match(env.PATH, /\/usr\/lib\/jvm\/java-17-openjdk-amd64\/bin/)
  assert.match(env.PATH, /\/home\/builder\/Android\/Sdk\/platform-tools/)
})

test('keeps an explicit ANDROID_HOME ahead of the Linux default', () => {
  const home = '/home/builder'
  const explicit = '/opt/explicit-sdk'
  const exists = (path) =>
    path === join(explicit, 'platform-tools') ||
    path === join(home, 'Android/Sdk', 'platform-tools')

  assert.equal(resolveAndroidHome({ ANDROID_HOME: explicit }, exists, home), explicit)
  assert.equal(resolveAdb({ ANDROID_HOME: explicit }, exists, home), 'adb')
})
