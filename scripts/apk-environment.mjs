export function apkBuildEnvironment(source, cargoBin) {
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
  delete env.LORO_ANDROID_DEV_CLIENT
  return env
}

// PostHog's project key and host are public by design (ADR-0011). The build ignores dotenv files,
// so a key kept only in apps/mobile/.env never reached an APK and every build sent no analytics:
// these two, and only these, are read from that file when the shell doesn't set them.
const POSTHOG_KEYS = ['EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_POSTHOG_HOST']

export function posthogFromDotenv(source, dotenv) {
  const found = {}
  for (const line of dotenv.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match || !POSTHOG_KEYS.includes(match[1])) continue
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    if (value) found[match[1]] = value
  }
  const env = {}
  for (const key of POSTHOG_KEYS) {
    const value = source[key] || found[key]
    if (value) env[key] = value
  }
  return env
}
