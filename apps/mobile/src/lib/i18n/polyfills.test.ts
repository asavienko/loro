import { expect, it } from 'vitest'

it('formats bundled plural messages when the device starts without Intl.PluralRules', async () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!
  Reflect.deleteProperty(Intl, 'PluralRules')
  try {
    const { message, setCopyLanguages } = await import('./index')
    expect(typeof Intl.PluralRules).toBe('function')
    setCopyLanguages('en', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 phrase')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 phrases')
    setCopyLanguages('bg', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 фраза')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 фрази')
    setCopyLanguages('ru', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 фраза')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 фразы')
    expect(message('onboarding.packSub', { phrases: 5 })).toBe('5 фраз')
    setCopyLanguages('en', 'es-ES')
  } finally {
    Object.defineProperty(Intl, 'PluralRules', original)
  }
})
