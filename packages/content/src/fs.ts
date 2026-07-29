/**
 * Filesystem loader — NODE ONLY.
 *
 * The authoring CLIs (validate, enrich, render, publish) must read the on-disk source
 * rather than a bundled copy, so a check runs against what the author just edited.
 *
 * The app never imports this. It uses the bundled snapshot in `catalog.ts`, because
 * Metro has no filesystem.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, CatalogPhrase, DropStep, Pack, Scenario } from './types.js'

const here = dirname(fileURLToPath(import.meta.url))
export const contentRoot = join(here, '..')

/**
 * Read a catalog file. Returns `unknown` deliberately: a generic here would be a
 * disguised cast, and the cast belongs where the shape is actually known.
 */
function read(lang: string, file: string): unknown {
  return JSON.parse(readFileSync(join(contentRoot, lang, file), 'utf8'))
}

/** Load the catalog from disk. Used by the authoring CLIs. */
export function loadCatalogFromDisk(lang = 'es-ES'): Catalog {
  const phrases = read(lang, 'phrases.json') as {
    lang: string
    catalogVersion: number
    phrases: CatalogPhrase[]
  }
  const scenarios = read(lang, 'scenarios.json') as { scenarios: Scenario[] }
  const packs = read(lang, 'packs.json') as { packs: Pack[] }
  const drops = read(lang, 'drops.json') as {
    schedules: Record<string, DropStep[]>
    rules: Catalog['dropRules']
  }

  return {
    lang: phrases.lang,
    catalogVersion: phrases.catalogVersion,
    phrases: phrases.phrases,
    scenarios: scenarios.scenarios,
    packs: packs.packs,
    drops: drops.schedules,
    dropRules: drops.rules,
  }
}
