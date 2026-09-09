import { accents, defaultAccent, type AccentName } from '@loro/design-tokens'

/**
 * Installation-local preferences. They never enter account sync and analytics consent never
 * grants audio or transcript upload permission.
 */
export interface DevicePreferences {
  readonly version: 2
  readonly analyticsConsent: boolean
  readonly accent: AccentName
  /** System preserves the platform accessibility preference; reduced always suppresses movement. */
  readonly motion: 'system' | 'reduced'
}

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = Object.freeze({
  version: 2,
  analyticsConsent: false,
  accent: defaultAccent,
  motion: 'system',
})

function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && value in accents
}

/** Missing, malformed and future schemas fail closed; v1 retains its explicit consent choice. */
export function decodeDevicePreferences(serialized: string | null): DevicePreferences {
  if (serialized === null) return DEFAULT_DEVICE_PREFERENCES
  try {
    const value: unknown = JSON.parse(serialized)
    if (typeof value !== 'object' || value === null) return DEFAULT_DEVICE_PREFERENCES
    const record = value as Record<string, unknown>
    if (typeof record['analyticsConsent'] !== 'boolean') return DEFAULT_DEVICE_PREFERENCES
    if (record['version'] === 1)
      return { ...DEFAULT_DEVICE_PREFERENCES, analyticsConsent: record['analyticsConsent'] }
    if (
      record['version'] !== 2 ||
      !isAccentName(record['accent']) ||
      (record['motion'] !== 'system' && record['motion'] !== 'reduced')
    )
      return DEFAULT_DEVICE_PREFERENCES
    return {
      version: 2,
      analyticsConsent: record['analyticsConsent'],
      accent: record['accent'],
      motion: record['motion'],
    }
  } catch {
    return DEFAULT_DEVICE_PREFERENCES
  }
}
