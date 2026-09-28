// Hermes lacks some of the Intl the copy uses (plurals, language names, relative times) and its
// number formatting differs by platform, so the formatjs implementations are forced, with data
// for the three UI languages: the app words a number the way the web prototype does.
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill-force';
import '@formatjs/intl-pluralrules/locale-data/en';
import '@formatjs/intl-pluralrules/locale-data/bg';
import '@formatjs/intl-pluralrules/locale-data/ru';
import '@formatjs/intl-numberformat/polyfill-force';
import '@formatjs/intl-numberformat/locale-data/en';
import '@formatjs/intl-numberformat/locale-data/bg';
import '@formatjs/intl-numberformat/locale-data/ru';
import '@formatjs/intl-relativetimeformat/polyfill-force';
import '@formatjs/intl-relativetimeformat/locale-data/en';
import '@formatjs/intl-relativetimeformat/locale-data/bg';
import '@formatjs/intl-relativetimeformat/locale-data/ru';
import '@formatjs/intl-displaynames/polyfill-force';
import '@formatjs/intl-displaynames/locale-data/en';
import '@formatjs/intl-displaynames/locale-data/bg';
import '@formatjs/intl-displaynames/locale-data/ru';
