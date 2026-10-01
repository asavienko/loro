// The UI follows the learner's native language. Language names come from the
// platform (Intl.DisplayNames), so they are correct and localised for free.
import { LanguageCode, uiLocaleOf, UiLocale } from '../content';
import { makeBg } from './bg';
import { makeCs } from './cs';
import { Copy, makeEn } from './en';
import { makePl } from './pl';
import { pluralFor } from './plural';
import { makeRu } from './ru';

export type { Copy } from './en';

const cache = new Map<UiLocale, Copy>();

export function copyFor(locale: UiLocale): Copy {
  let copy = cache.get(locale);
  if (!copy) {
    const make = { en: makeEn, bg: makeBg, ru: makeRu, pl: makePl, cs: makeCs }[locale];
    copy = make(pluralFor(locale));
    cache.set(locale, copy);
  }
  return copy;
}

export function copyForNative(native: LanguageCode): Copy {
  return copyFor(uiLocaleOf(native));
}

/**
 * "Spanish", "испанский", "испански" — in the UI language, as it is written
 * inside a sentence (Bulgarian, Russian, Polish and Czech don't capitalise language names).
 */
export function languageName(code: LanguageCode, uiLocale: string): string {
  try {
    return new Intl.DisplayNames([uiLocale], { type: 'language' }).of(code.split('-')[0]) ?? code;
  } catch {
    return code;
  }
}

/** A language name standing alone (a label, a list item, the start of a line): capitalised. */
export function languageLabel(code: LanguageCode, uiLocale: string): string {
  const name = languageName(code, uiLocale);
  return name.charAt(0).toLocaleUpperCase(uiLocale) + name.slice(1);
}

/** The greeting on Home, in the language being learned. */
export function greeting(target: LanguageCode, name: string): string {
  const who = name.trim();
  switch (target) {
    case 'bg-BG':
      return who ? `Здравей, ${who}!` : 'Здравей!';
    case 'ru-RU':
      return who ? `Привет, ${who}!` : 'Привет!';
    case 'pl-PL':
      return who ? `Cześć, ${who}!` : 'Cześć!';
    case 'cs-CZ':
      return who ? `Ahoj, ${who}!` : 'Ahoj!';
    case 'en-GB':
    case 'en-US':
      return who ? `Hello, ${who}!` : 'Hello!';
    default:
      return who ? `¡Hola, ${who}!` : '¡Hola!';
  }
}
