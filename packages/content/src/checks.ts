/**
 * Every mechanical content check, so human review can spend itself on naturalness.
 *
 * Exported as pure functions so they're unit-testable and so `validate.ts` is just
 * a CLI over them.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// The schema is draft 2020-12; Ajv's default export is draft-07.
// The package ships CJS, so the constructor arrives under `.default` under NodeNext.
import Ajv2020Module from 'ajv/dist/2020.js'
import type { ValidateFunction } from 'ajv'

const Ajv2020 = (Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module
interface Ajv2020Instance {
  compile: (schema: object) => ValidateFunction
}
type Ajv2020Ctor = new (opts: { allErrors: boolean; strict: boolean }) => Ajv2020Instance
// Checks read from DISK, not the bundled snapshot — they must validate what the
// author just edited.
import { contentRoot, loadCatalogFromDisk } from './fs.js'
import { isCloudAudioUri, isContentAddressedAudioUri } from './catalogAudio.js'
import { GRAPH_RELATIONS, stressedSyllables, THEMES, wordCount, type Catalog } from './types.js'

export interface Issue {
  check: string
  id?: string
  message: string
  /** `error` fails the build. `warn` is reported and tolerated. */
  level: 'error' | 'warn'
}

export type Check = (c: Catalog) => Issue[]

const err = (check: string, message: string, id?: string): Issue => ({
  check,
  message,
  level: 'error',
  ...(id === undefined ? {} : { id }),
})
const warn = (check: string, message: string, id?: string): Issue => ({
  check,
  message,
  level: 'warn',
  ...(id === undefined ? {} : { id }),
})

// ─────────────────────────────────────────────────────────────────────────────

let cachedValidator: ValidateFunction | undefined

function phraseValidator(): ValidateFunction {
  if (cachedValidator === undefined) {
    const schema: object = JSON.parse(
      readFileSync(join(contentRoot, 'schema', 'phrase.schema.json'), 'utf8'),
    ) as object
    // `strict: false` — the schema uses $comment/description liberally for authors.
    const ajv = new (Ajv2020 as Ajv2020Ctor)({ allErrors: true, strict: false })
    cachedValidator = ajv.compile(schema)
  }
  return cachedValidator
}

let cachedGraphValidator: ValidateFunction | undefined

function graphValidator(): ValidateFunction {
  if (cachedGraphValidator === undefined) {
    const schema: object = JSON.parse(
      readFileSync(join(contentRoot, 'schema', 'graph.schema.json'), 'utf8'),
    ) as object
    const ajv = new (Ajv2020 as Ajv2020Ctor)({ allErrors: true, strict: false })
    cachedGraphValidator = ajv.compile(schema)
  }
  return cachedGraphValidator
}

function localePrefix(id: string, catalogLang: string): string {
  const colon = id.indexOf(':')
  return colon === -1 ? catalogLang : id.slice(0, colon)
}

function prerequisiteCycle(edges: Catalog['graph']['edges']): string[] | undefined {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.relation !== 'prerequisite') continue
    const next = adj.get(edge.from) ?? []
    next.push(edge.to)
    adj.set(edge.from, next)
  }
  if (adj.size === 0) return undefined

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  const walk = (node: string): boolean => {
    if (visited.has(node)) return false
    if (visiting.has(node)) {
      stack.push(node)
      return true
    }
    visiting.add(node)
    stack.push(node)
    for (const next of adj.get(node) ?? []) {
      if (walk(next)) return true
    }
    stack.pop()
    visiting.delete(node)
    visited.add(node)
    return false
  }

  for (const node of adj.keys()) {
    if (walk(node)) {
      const repeated = stack[stack.length - 1] ?? ''
      return stack.slice(stack.indexOf(repeated))
    }
  }
  return undefined
}

/**
 * Authored edges: ends resolve, unique (from,to,relation), no same_theme storage,
 * no cross-locale pair, prerequisite subgraph acyclic.
 */
export const graphCheck: Check = (c) => {
  const issues: Issue[] = []
  const graphDoc = { lang: c.graph.lang, edges: c.graph.edges }
  const validate = graphValidator()
  const schemaOk: boolean = validate(graphDoc)
  if (!schemaOk) {
    for (const e of validate.errors ?? []) {
      issues.push(err('graph', `${e.instancePath || '/'} ${e.message ?? 'invalid'}`))
    }
  }

  const ids = new Set(c.phrases.map((p) => p.id))
  const seen = new Set<string>()
  const allowed = new Set<string>(GRAPH_RELATIONS)

  for (const edge of c.graph.edges) {
    const key = `${edge.from}\0${edge.to}\0${edge.relation}`
    if (seen.has(key)) {
      issues.push(
        err('graph', `duplicate edge (${edge.from} → ${edge.to}, ${edge.relation})`, edge.from),
      )
    }
    seen.add(key)

    if (!allowed.has(edge.relation)) {
      issues.push(err('graph', `unknown relation '${edge.relation}'`, edge.from))
    }
    if ((edge.relation as string) === 'same_theme') {
      issues.push(
        err('graph', 'same_theme is derived from phrase.theme and must not be stored', edge.from),
      )
    }

    if (edge.from === edge.to) {
      issues.push(err('graph', `self-edge ${edge.from}`, edge.from))
    }
    if (!ids.has(edge.from)) {
      issues.push(err('graph', `from references unknown phrase '${edge.from}'`, edge.from))
    }
    if (!ids.has(edge.to)) {
      issues.push(err('graph', `to references unknown phrase '${edge.to}'`, edge.to))
    }

    if (!Number.isInteger(edge.weight) || edge.weight < 1 || edge.weight > 100) {
      issues.push(err('graph', `weight must be an integer 1..=100, got ${edge.weight}`, edge.from))
    }

    const fromLocale = localePrefix(edge.from, c.lang)
    const toLocale = localePrefix(edge.to, c.lang)
    if (fromLocale !== toLocale) {
      issues.push(err('graph', `cross-locale edge ${edge.from} → ${edge.to}`, edge.from))
    }
    if (!c.lang.includes(':') && (edge.from.includes(':') || edge.to.includes(':'))) {
      issues.push(err('graph', `locale-prefixed id is not valid in ${c.lang} catalog`, edge.from))
    }
  }

  const cycle = prerequisiteCycle(c.graph.edges)
  if (cycle !== undefined) {
    issues.push(err('graph', `prerequisite cycle: ${cycle.join(' → ')}`, cycle[0]))
  }

  return issues
}

export const schemaCheck: Check = (c) => {
  const validate = phraseValidator()
  const issues: Issue[] = []
  for (const p of c.phrases) {
    // Deliberately not used as a type guard: `ValidateFunction<unknown>` narrows the
    // false branch to `never`, which would make `p.id` unreachable.
    const ok: boolean = validate(p)
    if (ok) continue
    for (const e of validate.errors ?? []) {
      issues.push(err('schema', `${e.instancePath || '/'} ${e.message ?? 'invalid'}`, p.id))
    }
  }
  return issues
}

/**
 * THE COUNT IN THE LABEL IS A PROMISE. A pack that says 8 phrases and delivers 4
 * lies to the learner in the onboarding summary and in the trip drop — so
 * `promisedCount` and `sub` must match membership exactly.
 *
 * `targetCount` is the authoring goal and only warns. It's the backlog signal.
 */
export const packCountCheck: Check = (c) =>
  c.packs.flatMap((p) => {
    const issues: Issue[] = []
    const actual = p.phrases.length

    if (actual !== p.promisedCount) {
      issues.push(
        err('packs', `label promises ${p.promisedCount} phrases but membership is ${actual}`, p.id),
      )
    }
    // The `sub` string is what the learner literally reads.
    if (p.sub !== undefined && p.sub !== `${actual} phrase${actual === 1 ? '' : 's'}`) {
      issues.push(err('packs', `sub reads '${p.sub}' but membership is ${actual}`, p.id))
    }
    // A draft pack has no content and must not be offered.
    if (p.draft === true) {
      if (actual > 0)
        issues.push(err('packs', 'marked draft but has phrases — clear the flag', p.id))
      if (p.onboarding) issues.push(err('packs', 'draft packs must not appear in onboarding', p.id))
      issues.push(warn('packs', `draft — needs ${p.targetCount ?? '?'} phrases authored`, p.id))
    } else if (actual === 0) {
      issues.push(err('packs', 'has no phrases and is not marked draft', p.id))
    } else if (p.targetCount !== undefined && actual < p.targetCount) {
      issues.push(
        warn(
          'packs',
          `${actual}/${p.targetCount} phrases authored — ${p.targetCount - actual} to go`,
          p.id,
        ),
      )
    }
    return issues
  })

/** Drop schedules must not deal a draft pack — it would unlock nothing. */
export const draftDropCheck: Check = (c) => {
  const draft = new Set(c.packs.filter((p) => p.draft === true).map((p) => p.id))
  return Object.entries(c.drops).flatMap(([len, steps]) =>
    steps
      .filter((s) => s.pack !== null && draft.has(s.pack))
      .map((s) =>
        warn(
          'drops',
          `day ${s.day} deals draft pack '${s.pack ?? ''}' — it would unlock nothing`,
          `${len}-day`,
        ),
      ),
  )
}

export const referenceCheck: Check = (c) => {
  const ids = new Set(c.phrases.map((p) => p.id))
  const packIds = new Set(c.packs.map((p) => p.id))
  const issues: Issue[] = []

  for (const pack of c.packs) {
    for (const ref of pack.phrases) {
      if (!ids.has(ref))
        issues.push(err('refs', `pack references unknown phrase '${ref}'`, pack.id))
    }
  }
  for (const s of c.scenarios) {
    for (const ref of s.phrases) {
      if (!ids.has(ref))
        issues.push(err('refs', `scenario references unknown phrase '${ref}'`, s.id))
    }
  }
  for (const [len, steps] of Object.entries(c.drops)) {
    for (const step of steps) {
      if (step.pack !== null && !packIds.has(step.pack)) {
        issues.push(
          err('refs', `drop day ${step.day} references unknown pack '${step.pack}'`, `${len}-day`),
        )
      }
    }
  }
  for (const p of c.phrases) {
    if (p.deprecated_by !== undefined && !ids.has(p.deprecated_by)) {
      issues.push(err('refs', `deprecated_by points at unknown phrase '${p.deprecated_by}'`, p.id))
    }
  }
  return issues
}

/** Missing clip — enqueue plans 98/99. Distinct from an unpublished `sha256/` identity. */
export const UNRENDERED_AUDIO = 'no rendered audio yet — run content:render'
/** Rendered locally; not yet a published cloud object. */
export const UNPUBLISHED_AUDIO = 'audio is content-addressed — publish the cloud https object'

export const audioCheck: Check = (c) =>
  c.phrases.flatMap((p) => {
    if (p.audio === undefined) return [warn('audio', UNRENDERED_AUDIO, p.id)]
    const issues: Issue[] = []
    if (!/^[a-f0-9]{64}$/.test(p.audio.sha256)) {
      issues.push(err('audio', 'audio sha256 is malformed', p.id))
    }
    if (isCloudAudioUri(p.audio.uri)) return issues
    if (isContentAddressedAudioUri(p.audio.uri, p.audio.sha256)) {
      issues.push(warn('audio', UNPUBLISHED_AUDIO, p.id))
      return issues
    }
    issues.push(
      err('audio', 'audio uri must be a cloud https object (http only for local authoring)', p.id),
    )
    return issues
  })

export const prosodyCheck: Check = (c) => {
  const issues: Issue[] = []
  for (const p of c.phrases) {
    if (p.f0_native !== undefined && p.f0_native.length !== 14) {
      issues.push(err('prosody', `f0_native must be 14 points, got ${p.f0_native.length}`, p.id))
    }
    if (p.syl !== undefined) {
      if (p.syl.length === 0) issues.push(err('prosody', 'syl is empty', p.id))
      for (const s of p.syl) {
        if (s.stress < 0 || s.stress > 1) {
          issues.push(err('prosody', `syllable '${s.t}' stress out of range`, p.id))
        }
        if (s.dur <= 0)
          issues.push(err('prosody', `syllable '${s.t}' has non-positive duration`, p.id))
      }
    }
  }
  return issues
}

export const duplicateCheck: Check = (c) => {
  const seen = new Map<string, string>()
  const issues: Issue[] = []
  for (const p of c.phrases) {
    const key = p.es.trim().toLowerCase()
    const prior = seen.get(key)
    if (prior !== undefined) {
      issues.push(err('duplicates', `duplicates the Spanish of '${prior}'`, p.id))
    } else {
      seen.set(key, p.id)
    }
  }
  const ids = new Set<string>()
  for (const p of c.phrases) {
    if (ids.has(p.id)) issues.push(err('duplicates', 'duplicate phrase id', p.id))
    ids.add(p.id)
  }
  return issues
}

/** The respelling must mark stress with CAPS — it's read by someone who's never seen IPA. */
export const stressCheck: Check = (c) =>
  c.phrases.flatMap((p) => {
    if (p.resp === undefined) return []
    const stressed = stressedSyllables(p.resp)
    if (stressed.length === 0) {
      return [err('stress', `respelling marks no stressed syllable: '${p.resp}'`, p.id)]
    }
    return []
  })

/** A1/A2 phrases must be learnable in six reps. */
export const lengthCheck: Check = (c) =>
  c.phrases.flatMap((p) => {
    const level = p.cefr ?? 'A1'
    if (level !== 'A1' && level !== 'A2') return []
    const n = wordCount(p.es)
    return n > 8 ? [err('length', `${level} phrase is ${n} words (max 8)`, p.id)] : []
  })

export const themeCheck: Check = (c) =>
  c.phrases.flatMap((p) =>
    (THEMES as readonly string[]).includes(p.theme)
      ? []
      : [err('theme', `unknown theme '${p.theme}'`, p.id)],
  )

export const emojiCheck: Check = (c) =>
  c.phrases.flatMap((p) => {
    const count = [...new Intl.Segmenter().segment(p.emoji)].length
    return count === 1 ? [] : [err('emoji', `expected exactly one emoji, got ${count}`, p.id)]
  })

/** The `say` field is required whenever a word chip's text is a fragment. */
export const wordGlossCheck: Check = (c) =>
  c.phrases.flatMap((p) =>
    (p.words ?? []).flatMap((w) => {
      const looksLikeFragment = /^[¿¡]/.test(w.es) || /[?!,.]$/.test(w.es)
      return looksLikeFragment && w.say === undefined
        ? [err('words', `word chip '${w.es}' is a fragment and needs a 'say' value`, p.id)]
        : []
    }),
  )

/** Scenarios should get someone through the real situation: 4-6 phrases. */
export const scenarioShapeCheck: Check = (c) =>
  c.scenarios.flatMap((s) =>
    s.phrases.length < 4 || s.phrases.length > 6
      ? [warn('scenarios', `has ${s.phrases.length} phrases (guideline 4-6)`, s.id)]
      : [],
  )

/** No new phrases on the final day of a countdown. Cramming produces anxiety. */
export const dropRuleCheck: Check = (c) => {
  const issues: Issue[] = []
  for (const [len, steps] of Object.entries(c.drops)) {
    const finalDay = steps.find((s) => s.day === 1)
    if (finalDay === undefined) {
      issues.push(err('drops', 'schedule has no day-1 entry', `${len}-day`))
    } else if (finalDay.pack !== null) {
      issues.push(err('drops', 'the final day must be review-only', `${len}-day`))
    }
    const days = steps.map((s) => s.day)
    if (new Set(days).size !== days.length) {
      issues.push(err('drops', 'schedule has duplicate days', `${len}-day`))
    }
  }
  return issues
}

export const ALL_CHECKS: Record<string, Check> = {
  schema: schemaCheck,
  packs: packCountCheck,
  refs: referenceCheck,
  audio: audioCheck,
  prosody: prosodyCheck,
  duplicates: duplicateCheck,
  stress: stressCheck,
  length: lengthCheck,
  theme: themeCheck,
  emoji: emojiCheck,
  words: wordGlossCheck,
  scenarios: scenarioShapeCheck,
  drops: dropRuleCheck,
  draftDrops: draftDropCheck,
  graph: graphCheck,
}

/** Run selected validation strategies against an already-loaded catalog. */
export function runChecksForCatalog(
  catalog: Catalog,
  names: string[] = Object.keys(ALL_CHECKS),
): Issue[] {
  return names.flatMap((n) => {
    const check = ALL_CHECKS[n]
    if (check === undefined) throw new Error(`unknown check '${n}'`)
    return check(catalog)
  })
}

/** Load an authoring catalog from disk, then run the selected validation strategies. */
export function runChecks(names: string[] = Object.keys(ALL_CHECKS), lang = 'es-ES'): Issue[] {
  return runChecksForCatalog(loadCatalogFromDisk(lang), names)
}
