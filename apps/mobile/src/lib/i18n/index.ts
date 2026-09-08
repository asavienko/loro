/** F-08. Bundled, synchronous translations; no translation request needs a network. */
import './polyfills'
import { createInstance, type i18n as I18nInstance } from 'i18next'
import ICU from 'i18next-icu'
import { initReactI18next, useTranslation } from 'react-i18next'
import type { NativeLanguage, TargetLocale } from '@loro/core'
import en from './en.json'
import bg from './bg.json'
import ru from './ru.json'

export type MessageKey = keyof typeof en
export const translationResources = { en, bg, ru }
export const i18n: I18nInstance = createInstance()
void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    initAsync: false,
    keySeparator: false,
    resources: { en: { translation: en }, bg: { translation: bg }, ru: { translation: ru } },
    interpolation: { escapeValue: false },
  })
let activeTarget: TargetLocale = 'es-ES'
export function setCopyLanguages(nativeLanguage: NativeLanguage, targetLocale: TargetLocale): void {
  activeTarget = targetLocale
  void i18n.changeLanguage(nativeLanguage)
}
export function useLocale(): void {
  useTranslation()
}
export function currentTargetLocale(): TargetLocale {
  return activeTarget
}
export function currentNativeLanguage(): NativeLanguage {
  return i18n.language === 'bg' ? 'bg' : i18n.language === 'ru' ? 'ru' : 'en'
}
const targetNames: Record<NativeLanguage, Record<TargetLocale, string>> = {
  en: { 'es-ES': 'Spanish', 'bg-BG': 'Bulgarian', 'ru-RU': 'Russian' },
  bg: { 'es-ES': 'испански', 'bg-BG': 'български', 'ru-RU': 'руски' },
  ru: { 'es-ES': 'испанский', 'bg-BG': 'болгарский', 'ru-RU': 'русский' },
}
const targetPunctuation = {
  'es-ES': { greeting: '¡Hola!', done: '¡Hecho!' },
  'bg-BG': { greeting: 'Здравей!', done: 'Готово!' },
  'ru-RU': { greeting: 'Привет!', done: 'Готово!' },
}
export function message(key: MessageKey, parameters: Record<string, unknown> = {}): string {
  return i18n.t(key, {
    targetName: targetNames[currentNativeLanguage()][activeTarget],
    ...targetPunctuation[activeTarget],
    ...parameters,
  })
}
export function formatBuckets(buckets: readonly { count: number; label: string }[]): string {
  const locale = currentNativeLanguage()
  const numbers = new Intl.NumberFormat(locale)
  return `${buckets.map((b) => `${numbers.format(b.count)} ${b.label.toLocaleLowerCase(locale)}`).join(', ')}.`
}
