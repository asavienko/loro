/** Catalog types. No platform runtime, so every consumer can import them freely. */

import { BROWSABLE_THEMES } from '@loro/core'

export type { CatalogPhrase, WordGloss } from '@loro/core/api/catalog'
import type { CatalogPhrase } from '@loro/core/api/catalog'

export interface Scenario {
  id: string
  label: string
  emoji: string
  /** ORDER IS THE ARC of the real interaction. */
  phrases: string[]
  arc?: string
}

export interface Pack {
  id: string
  label: string
  emoji: string
  /** What the learner literally reads, e.g. "4 phrases". Must match membership. */
  sub?: string
  /** The count shown to the learner. CI errors if it differs from membership. */
  promisedCount: number
  /** The authoring goal. Warns only — the backlog signal, never displayed. */
  targetCount?: number
  /** No phrases yet. Excluded from onboarding; drops that deal it warn. */
  draft?: boolean
  onboarding: boolean
  trip: boolean
  phrases: string[]
  note?: string
}

export interface DropStep {
  day: number
  pack: string | null
  reviewOnly?: boolean
  note?: string
}

/** Authored relations. `same_theme` is derived from phrase.theme and must not be stored. */
export const GRAPH_RELATIONS = [
  'scenario_next',
  'reply',
  'lexical',
  'contrast',
  'prerequisite',
  'register_shift',
] as const

export type GraphRelation = (typeof GRAPH_RELATIONS)[number]

export interface GraphEdge {
  from: string
  to: string
  relation: GraphRelation
  /** Authored confidence, 1..=100. */
  weight: number
}

export interface PhraseGraph {
  lang: string
  edges: GraphEdge[]
}

export interface Catalog {
  lang: string
  catalogVersion: number
  phrases: CatalogPhrase[]
  scenarios: Scenario[]
  packs: Pack[]
  drops: Record<string, DropStep[]>
  dropRules: {
    unlockHourLocal: number
    noNewPhrasesOnFinalDay: boolean
    missedDropsMergeForward: boolean
    futureDropsCanBePulledForward: boolean
    dormantAboveDays: number
  }
  /** Authored edges. Same-theme adjacency is derived, never stored. */
  graph: PhraseGraph
}

/** The eight taxonomic themes. Core owns the closed set consumed by Browse. */
export const THEMES = BROWSABLE_THEMES

/** Word count, used by the A1/A2 length rule. */
export function wordCount(es: string): number {
  return es.trim().split(/\s+/).filter(Boolean).length
}

/** Syllables the respelling marks as stressed — the CAPS ones. */
export function stressedSyllables(resp: string): string[] {
  return resp.split(/[\s-]+/).filter((s) => /[A-ZÁÉÍÓÚÑ]{2,}/.test(s))
}
