import { Platform } from 'react-native'
import { currentTargetLocale } from '../../src/lib/i18n'

export function targetLanguageInputProps() {
  const language = currentTargetLocale()
  return {
    accessibilityLanguage: language,
    ...(Platform.OS === 'web' ? { lang: language } : {}),
  }
}
