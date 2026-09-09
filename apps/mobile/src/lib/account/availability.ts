/** F-01: capability copy must match the methods that are actually available. */
export type DiscoveryStatus = 'loading' | 'ready' | 'error'

export interface MethodDiscovery {
  configured: boolean
  providerStatus: DiscoveryStatus
  capabilityStatus: DiscoveryStatus
  providerCount: number
  emailAvailable: boolean
}

export type MethodNotice =
  | 'checking'
  | 'discoveryError'
  | 'unconfigured'
  | 'allUnavailable'
  | 'providersUnavailable'
  | null

export function methodNotice(state: MethodDiscovery): MethodNotice {
  if (!state.configured) return 'unconfigured'
  if (state.providerStatus === 'error' || state.capabilityStatus === 'error') return 'discoveryError'
  if (state.providerStatus === 'loading' || state.capabilityStatus === 'loading') return 'checking'
  if (state.providerCount === 0 && !state.emailAvailable) return 'allUnavailable'
  if (state.providerCount === 0 && state.emailAvailable) return 'providersUnavailable'
  return null
}

export function methodUnavailableHint(state: {
  busy: boolean
  ready: boolean
  available: boolean
}): boolean {
  return !state.busy && state.ready && !state.available
}
