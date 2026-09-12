import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const JAVA_HOME_CANDIDATES = [
  '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
  '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/usr/lib/jvm/java-17-openjdk-amd64',
  '/usr/lib/jvm/java-17-openjdk',
]

export function javaHomeCandidates(home = homedir()) {
  return [join(home, '.sdkman/candidates/java/current'), ...JAVA_HOME_CANDIDATES]
}

export function androidSdkCandidates(home = homedir()) {
  return [
    join(home, 'Library/Android/sdk'),
    join(home, 'Android/Sdk'),
    '/opt/android-sdk',
    '/usr/lib/android-sdk',
  ]
}

export function resolveJavaHome(env = {}, exists = existsSync, home = homedir()) {
  if (env.JAVA_HOME && exists(join(env.JAVA_HOME, 'bin/java'))) return env.JAVA_HOME
  return javaHomeCandidates(home).find((candidate) => exists(join(candidate, 'bin/java')))
}

export function resolveAndroidHome(env = {}, exists = existsSync, home = homedir()) {
  const preferred = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean)
  const installed = [...preferred, ...androidSdkCandidates(home)].find((candidate) =>
    exists(join(candidate, 'platform-tools')),
  )
  return installed ?? preferred[0] ?? androidSdkCandidates(home)[0]
}

export function resolveAdb(env = process.env, exists = existsSync, home = homedir()) {
  const sdk = resolveAndroidHome(env, exists, home)
  const sdkAdb = join(sdk, 'platform-tools', 'adb')
  return exists(sdkAdb) ? sdkAdb : 'adb'
}

export function apkBuildEnvironment(source, cargoBin, exists = existsSync, home = homedir()) {
  const env = {
    ...source,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    LORO_LOCAL_APK: '1',
    CMAKE_BUILD_PARALLEL_LEVEL: source.CMAKE_BUILD_PARALLEL_LEVEL || '2',
    CARGO_BUILD_JOBS: source.CARGO_BUILD_JOBS || '2',
    PATH: `${cargoBin}:${source.PATH || ''}`,
  }
  const javaHome = resolveJavaHome(env, exists, home)
  if (javaHome) {
    env.JAVA_HOME = javaHome
    env.PATH = `${join(javaHome, 'bin')}:${env.PATH}`
  }
  const androidHome = resolveAndroidHome(env, exists, home)
  if (androidHome) {
    env.ANDROID_HOME = androidHome
    env.ANDROID_SDK_ROOT = androidHome
    env.PATH = `${join(androidHome, 'platform-tools')}:${join(androidHome, 'emulator')}:${env.PATH}`
  }
  delete env.LORO_ANDROID_DEV_CLIENT
  return env
}
