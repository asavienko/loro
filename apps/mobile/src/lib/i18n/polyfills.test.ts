import { expect, it } from 'vitest'

it('formats bundled plural messages when the device starts without Intl.PluralRules', async () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!
  Reflect.deleteProperty(Intl, 'PluralRules')
  try {
    const { message, setCopyLanguages } = await import('./index')
    expect(typeof Intl.PluralRules).toBe('function')
    setCopyLanguages('en', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 curated phrase')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 curated phrases')
    expect(message('onboarding.packPrime', { count: 10 })).toBe('10 phrases will seed your stream')
    setCopyLanguages('bg', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 подбрана фраза')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 подбрани фрази')
    expect(message('onboarding.packPrime', { count: 10 })).toBe('10 фрази ще заредят потока')
    setCopyLanguages('ru', 'es-ES')
    expect(message('onboarding.packSub', { phrases: 1 })).toBe('1 отобранная фраза')
    expect(message('onboarding.packSub', { phrases: 2 })).toBe('2 отобранные фразы')
    expect(message('onboarding.packSub', { phrases: 5 })).toBe('5 отобранных фраз')
    expect(message('onboarding.packPrime', { count: 10 })).toBe('10 фраз попадут в поток')
    setCopyLanguages('en', 'es-ES')
  } finally {
    Object.defineProperty(Intl, 'PluralRules', original)
  }
})
