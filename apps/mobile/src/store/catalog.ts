/**
 * The bundled phrase catalog, loaded once.
 *
 * Module-level rather than injected: the catalog is a read-only asset that ships with the
 * app (ADR-0009), so a second load would be a second copy of the same rows. The lookup
 * map is built here too — `PhraseState.phraseId` is a JOIN KEY into it, and resolving that
 * key by scanning the array is how a render-time O(n²) creeps in.
 *
 * Content ships independently of the app, so nothing here may assume a catalog id exists:
 * every lookup returns `undefined`/`null` and every caller handles it.
 */

import { loadCatalog, type CatalogPhrase } from '@loro/content'

const catalog = loadCatalog()

export const catalogPhrases = catalog.phrases
export const packs = catalog.packs
export const scenarios = catalog.scenarios

/** Catalog id → entry. The one place `phraseId` is resolved to content. */
export const catalogById = new Map(catalog.phrases.map((p) => [p.id, p]))

/**
 * The catalog entries behind a set of starter packs, deduped, in pack order.
 *
 * Deduped because packs overlap — two packs naming the same phrase must seed ONE row, or
 * the learner's first stream shows a phrase twice. Unknown ids are dropped rather than
 * throwing: a pack list can outlive a content change.
 */
export function packPhrases(packIds: readonly string[]): CatalogPhrase[] {
  const chosen = new Set<string>()
  for (const packId of packIds) {
    const pack = packs.find((p) => p.id === packId)
    for (const pid of pack?.phrases ?? []) chosen.add(pid)
  }
  return [...chosen]
    .map((id) => catalogById.get(id))
    .filter((c): c is CatalogPhrase => c !== undefined)
}
