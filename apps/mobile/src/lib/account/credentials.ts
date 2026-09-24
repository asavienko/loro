import type { AccountSession } from './types'

export interface SavedCredential extends AccountSession {
  installationId: string
  refreshToken: string
}

export function readCredential(raw: string): SavedCredential | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  if (
    !('accountId' in value) ||
    typeof value.accountId !== 'string' ||
    !('deviceId' in value) ||
    typeof value.deviceId !== 'string' ||
    !('installationId' in value) ||
    typeof value.installationId !== 'string' ||
    !('refreshToken' in value) ||
    typeof value.refreshToken !== 'string'
  )
    return null
  const email =
    'email' in value && typeof value.email === 'string' && value.email.includes('@')
      ? value.email
      : null
  return {
    accountId: value.accountId,
    deviceId: value.deviceId,
    installationId: value.installationId,
    refreshToken: value.refreshToken,
    ...(email ? { email } : {}),
  }
}
