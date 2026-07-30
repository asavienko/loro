export interface DevToolsEnvironment {
  readonly isDevelopmentBuild: boolean
}

export type DevToolsAvailability = 'available' | 'unavailable'

/**
 * Keep the decision pure so a release build cannot accidentally acquire a
 * runtime switch that exposes developer surfaces.
 */
export function resolveDevToolsAvailability({
  isDevelopmentBuild,
}: DevToolsEnvironment): DevToolsAvailability {
  return isDevelopmentBuild ? 'available' : 'unavailable'
}

export function devToolsAreAvailable(): boolean {
  return resolveDevToolsAvailability({ isDevelopmentBuild: __DEV__ }) === 'available'
}
