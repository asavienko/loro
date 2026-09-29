/** F-08: language identities are independent of translated display names. */
export const NATIVE_LANGUAGES = ['en', 'bg', 'ru'] as const
export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number]
export const TARGET_LOCALES = ['es-ES', 'bg-BG', 'ru-RU'] as const
export type TargetLocale = (typeof TARGET_LOCALES)[number]
export interface LanguagePair {
  nativeLanguage: NativeLanguage
  targetLocale: TargetLocale
}
export function isNativeLanguage(value: string): value is NativeLanguage {
  return NATIVE_LANGUAGES.some((language) => language === value)
}
export function isTargetLocale(value: string): value is TargetLocale {
  return TARGET_LOCALES.some((language) => language === value)
}
export function supportsPair(nativeLanguage: string, targetLocale: string): boolean {
  return (
    isNativeLanguage(nativeLanguage) &&
    isTargetLocale(targetLocale) &&
    targetLocale.split('-')[0] !== nativeLanguage
  )
}
export function assertLanguagePair(
  nativeLanguage: string,
  targetLocale: string,
): asserts nativeLanguage is NativeLanguage {
  if (!supportsPair(nativeLanguage, targetLocale))
    throw new Error(`Unsupported language pair: ${nativeLanguage} → ${targetLocale}`)
}
/** No installed and validated native speech implementation exists yet. */
export const LANGUAGE_CAPABILITIES = Object.fromEntries(
  TARGET_LOCALES.map((locale) => [
    locale,
    {
      audio: false,
      asr: false,
      pronunciationScoring: false,
    },
  ]),
) as Record<TargetLocale, { audio: boolean; asr: boolean; pronunciationScoring: boolean }>
