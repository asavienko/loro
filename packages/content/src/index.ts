/**
 * @loro/content — the Spanish catalog.
 *
 * The default export path is the BUNDLED snapshot, so this package works in Metro,
 * Node, and the browser alike. The authoring CLIs import `./fs.js` instead, which
 * reads the on-disk source.
 *
 * See ADR-0009.
 */

export * from './types.js'
export * from './roleplay.js'
export * from './delivery.js'
export { bundledCatalog } from './catalog.js'

import { bundledCatalog } from './catalog.js'
import type { Catalog } from './types.js'

/**
 * Load the catalog.
 *
 * Returns the bundled snapshot. Only `es-ES` ships in v1; a different `lang` throws
 * rather than silently returning Spanish.
 */
export function loadCatalog(lang = 'es-ES'): Catalog {
  if (lang !== bundledCatalog.lang) {
    throw new Error(`no bundled catalog for '${lang}' (have '${bundledCatalog.lang}')`)
  }
  return bundledCatalog
}

export * from './multilingual.js'
