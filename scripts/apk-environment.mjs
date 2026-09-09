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
