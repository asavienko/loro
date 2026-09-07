import { expect, it, vi } from 'vitest'

it('fills the Hermes Intl gaps for every supported UI language', async () => {
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(Intl)
  delete descriptors.getCanonicalLocales
  delete descriptors.Locale
  delete descriptors.PluralRules
  const missing = Object.defineProperties({}, descriptors) as typeof Intl
  vi.stubGlobal('Intl', missing)
  try {
    await import('./intl.native')
    expect(new Intl.PluralRules('en').select(1)).toBe('one')
    expect(new Intl.PluralRules('bg').select(2)).toBe('other')
    expect([1, 2, 5].map((n) => new Intl.PluralRules('ru').select(n))).toEqual([
      'one',
      'few',
      'many',
    ])
  } finally {
    vi.unstubAllGlobals()
  }
})
