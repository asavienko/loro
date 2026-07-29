/**
 * The bundled catalog snapshot.
 *
 * Imported as JSON so it works in EVERY consumer — Metro (which has no filesystem),
 * Node, and the browser. This is the "bundled snapshot ships in the app binary" from
 * ADR-0009: a fresh install with no network still has the onboarding packs.
 *
 * The Node-only filesystem loader lives in `fs.ts` and is used by the authoring CLIs,
 * which need to read the on-disk source rather than a bundled copy.
 */

import phrasesJson from '../es-ES/phrases.json' with { type: 'json' }
import scenariosJson from '../es-ES/scenarios.json' with { type: 'json' }
import packsJson from '../es-ES/packs.json' with { type: 'json' }
import dropsJson from '../es-ES/drops.json' with { type: 'json' }
import type { Catalog, CatalogPhrase } from './types.js'

/**
 * Only `phrases` is cast, and only because TypeScript widens JSON string literals to
 * `string` — which `register` ("neutral" | "formal" | "casual") and `cefr` cannot
 * accept. Everything else is checked structurally by the `Catalog` annotation, so a
 * hand-edit that drops a field or mistypes a number fails the build here.
 *
 * The cast gives up exactly the string-union checks on phrases, and no more.
 * `checks.ts` re-asserts those unions against the same source, so `pnpm
 * content:validate` closes the gap rather than leaving it open.
 */
export const bundledCatalog: Catalog = {
  lang: phrasesJson.lang,
  catalogVersion: phrasesJson.catalogVersion,
  phrases: phrasesJson.phrases as CatalogPhrase[],
  scenarios: scenariosJson.scenarios,
  packs: packsJson.packs,
  drops: dropsJson.schedules,
  dropRules: dropsJson.rules,
}
