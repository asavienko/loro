/** Hermes in Expo SDK 54 lacks PluralRules; bundle all three UI locales before ICU starts. */
import '@formatjs/intl-pluralrules/polyfill-force.js'
import '@formatjs/intl-pluralrules/locale-data/en.js'
import '@formatjs/intl-pluralrules/locale-data/bg.js'
import '@formatjs/intl-pluralrules/locale-data/ru.js'
