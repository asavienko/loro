import { LoroError } from '../common/errors.js'
import type { AuthPrincipal } from './auth.tokens.js'

/** Presented `X-Loro-Device` must match the session device when present. */
export function assertDeviceHeader(
  principal: AuthPrincipal,
  header: string | string[] | undefined,
): void {
  const value = Array.isArray(header) ? header[0] : header
  if (value !== undefined && value !== principal.deviceId) throw new LoroError('FORBIDDEN')
}
