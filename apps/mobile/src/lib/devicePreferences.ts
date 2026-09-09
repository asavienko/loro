/** F-05/F-06: installation-local consent. Never part of account sync or audio permission. */
export interface DevicePreferences {
  readonly version: 1
  readonly analyticsConsent: boolean
}

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = Object.freeze({
  version: 1,
  analyticsConsent: false,
})

/** Missing, malformed and future schemas fail closed; no implicit consent migration. */
export function decodeDevicePreferences(serialized: string | null): DevicePreferences {
  if (serialized === null) return DEFAULT_DEVICE_PREFERENCES
  try {
    const value: unknown = JSON.parse(serialized)
    if (typeof value !== 'object' || value === null) return DEFAULT_DEVICE_PREFERENCES
    const record = value as Record<string, unknown>
    if (record['version'] !== 1 || typeof record['analyticsConsent'] !== 'boolean')
      return DEFAULT_DEVICE_PREFERENCES
    return { version: 1, analyticsConsent: record['analyticsConsent'] }
  } catch {
    return DEFAULT_DEVICE_PREFERENCES
  }
}
