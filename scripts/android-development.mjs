import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const developmentAppId = 'app.loro.android.dev'
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/mobile')

export function validateDevelopmentArguments(args) {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--binary' || argument.startsWith('--binary=')) {
      throw new Error(
        'The Android development command builds and launches Loro Development only. Use pnpm apk:local for a standalone Preview APK.',
      )
    }
    if (argument === '--app-id' || argument.startsWith('--app-id=')) {
      throw new Error(
        'The Android development command owns the Loro Development app ID. Use pnpm apk:local for a standalone Preview APK.',
      )
    }
    const variant = argument === '--variant' ? args[index + 1] : undefined
    const equalsVariant = argument.startsWith('--variant=')
      ? argument.slice('--variant='.length)
      : undefined
    if (
      (argument === '--variant' && variant !== 'debug') ||
      (equalsVariant !== undefined && equalsVariant !== 'debug')
    ) {
      throw new Error(
        'The Android development command supports only the debug variant. Use pnpm apk:local for the standalone Preview APK.',
      )
    }
  }
}

export function developmentEnvironment(source) {
  return {
    ...source,
    LORO_ANDROID_DEV_CLIENT: '1',
    // Expo dotenv loading preserves explicit process values, so this also prevents a local
    // Preview-only .env value from selecting the wrong generated Android identity.
    LORO_LOCAL_APK: '0',
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: mobileRoot, env, stdio: 'inherit' })
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`,
    )
}

export function runAndroidDevelopment(args) {
  validateDevelopmentArguments(args)
  const env = developmentEnvironment(process.env)
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  run(pnpm, ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'], env)
  run(pnpm, ['exec', 'expo', 'run:android', '--app-id', developmentAppId, ...args], env)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAndroidDevelopment(process.argv.slice(2))
}
