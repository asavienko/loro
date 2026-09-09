export const primaryNativeRedirectUri = 'loro://account'
export const developmentNativeRedirectUri = 'loro-dev://account'

/** Only application identities emitted by app.config.ts may be used for native OAuth callbacks. */
export function configuredNativeRedirectUri(value: unknown): string {
  return value === developmentNativeRedirectUri
    ? developmentNativeRedirectUri
    : primaryNativeRedirectUri
}
