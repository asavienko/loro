import type { OAuthProvider } from '@loro/core/api/oauth'

export type HubTone = 'idle' | 'connecting' | 'cancelled' | 'error' | 'unavailable'

export function resolveHubTone({
  busy,
  activeProvider,
  socialUnavailable,
  outcome,
}: {
  busy: boolean
  activeProvider: OAuthProvider | null
  socialUnavailable: boolean
  outcome: 'idle' | 'cancelled' | 'error'
}): HubTone {
  if (busy && activeProvider) return 'connecting'
  if (socialUnavailable) return 'unavailable'
  if (outcome === 'error') return 'error'
  if (outcome === 'cancelled') return 'cancelled'
  return 'idle'
}

export function googleMethodLabel(
  tone: HubTone,
  labels: { idle: string; cancelled: string; error: string; connecting: string },
): string {
  if (tone === 'connecting') return labels.connecting
  if (tone === 'cancelled') return labels.cancelled
  if (tone === 'error') return labels.error
  return labels.idle
}

export function appleMethodLabel(tone: HubTone, labels: { idle: string; error: string }): string {
  return tone === 'error' ? labels.error : labels.idle
}
