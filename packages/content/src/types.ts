/** Catalog types. No platform runtime, so every consumer can import them freely. */

import { BROWSABLE_THEMES, type BrowsableTheme } from '@loro/core'

export interface WordGloss {
  es: string
  gloss: string
  /** Required when `es` is a fragment: '¿Dón' → 'dónde'. The chips are tappable. */
  say?: string
}

export interface CatalogPhrase {
  id: string
  es: string
  en: string
  theme: BrowsableTheme
  emoji: string
  register?: 'neutral' | 'casual' | 'formal'
  cefr?: 'A1' | 'A2' | 'B1' | 'B2'
  resp?: string
  resp_ipa?: string
  words?: WordGloss[]
  example?: { es: string; en: string }
  hint?: string
  note?: string
  syl?: { t: string; stress: number; dur: number }[]
  f0_native?: number[]
  audio?: { uri: string; sha256: string; ms: number }
  deprecated_by?: string
}

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
