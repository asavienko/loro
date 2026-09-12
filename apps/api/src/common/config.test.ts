import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from './config.js'

describe('config accessors', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('treats whitespace-only AUTH_PUBLIC_URL as unset', () => {
    vi.stubEnv('AUTH_PUBLIC_URL', '   ')
    expect(config.publicUrl()).toBeUndefined()
    vi.stubEnv('AUTH_PUBLIC_URL', 'https://api.example.test/')
    expect(config.publicUrl()).toBe('https://api.example.test/')
  })

  it('keeps the listen port as the raw string the download fallback uses', () => {
    vi.stubEnv('PORT', '4010')
    expect(config.listenPort()).toBe('4010')
    expect(config.port()).toBe(4010)
  })
})
