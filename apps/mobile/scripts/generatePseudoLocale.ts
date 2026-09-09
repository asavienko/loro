/** F-08 / plan 72. Regenerate the development UI fixture; unit tests enforce drift. */
import { writeFileSync } from 'node:fs'
import en from '../src/lib/i18n/en.json'
import { pseudoResources } from '../src/lib/i18n/pseudoLocale'

writeFileSync(
  new URL('../src/lib/i18n/en-XA.json', import.meta.url),
  `${JSON.stringify(pseudoResources(en), null, 2)}\n`,
)
