// The UI follows the learner's native language. Language names come from the
// platform (Intl.DisplayNames), so they are correct and localised for free.
import { LanguageCode, uiLocaleOf, UiLocale } from '../content';
import { makeBg } from './bg';
import { Copy, makeEn } from './en';
import { pluralFor } from './plural';
import { makeRu } from './ru';

export type { Copy } from './en';

const cache = new Map<UiLocale, Copy>();

export function copyFor(locale: UiLocale): Copy {
  let copy = cache.get(locale);
  if (!copy) {
    const make = locale === 'bg' ? makeBg : locale === 'ru' ? makeRu : makeEn;
    copy = make(pluralFor(locale));
    cache.set(locale, copy);
  }
  return copy;
}

export function copyForNative(native: LanguageCode): Copy {
  return copyFor(uiLocaleOf(native));
}

/** "Spanish", "испанский", "испански" — in the UI language. */
export function languageName(code: LanguageCode, uiLocale: string): string {
  try {
    const base = code.split('-')[0];
    const name = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(base) ?? code;
    return uiLocale.startsWith('en') ? name : name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}

/** The greeting on Home, in the language being learned. */
export function greeting(target: LanguageCode, name: string): string {
  const who = name.trim();
  switch (target) {
    case 'bg-BG':
      return who ? `Здравей, ${who}!` : 'Здравей!';
    case 'ru-RU':
      return who ? `Привет, ${who}!` : 'Привет!';
    case 'en-GB':
      return who ? `Hello, ${who}!` : 'Hello!';
    default:
      return who ? `¡Hola, ${who}!` : '¡Hola!';
  }
}
