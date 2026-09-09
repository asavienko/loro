import { describe, expect, it } from 'vitest'
import {
  configuredNativeRedirectUri,
  developmentNativeRedirectUri,
  primaryNativeRedirectUri,
} from './redirect'

describe('configuredNativeRedirectUri', () => {
  it('uses the development callback only for the known development identity', () => {
    expect(configuredNativeRedirectUri(developmentNativeRedirectUri)).toBe(
      developmentNativeRedirectUri,
    )
  })

  it('falls back to the primary callback for absent or invalid configuration', () => {
    expect(configuredNativeRedirectUri(undefined)).toBe(primaryNativeRedirectUri)
    expect(configuredNativeRedirectUri('loro-other://account')).toBe(primaryNativeRedirectUri)
  })
})
