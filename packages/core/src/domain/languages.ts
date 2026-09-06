/** F-08: language identities are independent of translated display names. */
export const NATIVE_LANGUAGES = ['en', 'bg', 'ru'] as const
export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number]
export const TARGET_LOCALES = ['es-ES', 'bg-BG', 'ru-RU'] as const
export type TargetLocale = (typeof TARGET_LOCALES)[number]
export const LANGUAGE_NAMES = {
  en: 'English',
  bg: 'Български',
  ru: 'Русский',
  'es-ES': 'Español',
  'bg-BG': 'Български',
  'ru-RU': 'Русский',
} as const
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
export function detectNativeLanguage(languageTag: string | undefined): NativeLanguage {
  const language = languageTag?.toLowerCase().split(/[-_]/)[0] ?? 'en'
  return isNativeLanguage(language) ? language : 'en'
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

/** Parse persisted or remote settings atomically; corrupted pairs must not select a course. */
export function parseLanguagePair(value: unknown): LanguagePair {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('nativeLanguage' in value) ||
    !('targetLocale' in value) ||
    typeof value.nativeLanguage !== 'string' ||
    typeof value.targetLocale !== 'string' ||
    !isNativeLanguage(value.nativeLanguage) ||
    !isTargetLocale(value.targetLocale) ||
    !supportsPair(value.nativeLanguage, value.targetLocale)
  ) {
    throw new Error('Invalid language pair')
  }
  return { nativeLanguage: value.nativeLanguage, targetLocale: value.targetLocale }
}
