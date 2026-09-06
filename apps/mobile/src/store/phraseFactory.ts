/**
 * Row factories — the two ways a `PhraseState` comes into existence.
 *
 * Every field of a new row is set in exactly one place, so a field added to `PhraseState`
 * is a type error here rather than an `undefined` that surfaces three screens later.
 */

import {
  LadderRung,
  type CatalogPhraseId,
  type PhraseState,
  type Theme,
  type UserPhraseId,
} from '@loro/core'

/**
 * A blank row.
 *
 * `id` is a generated UUIDv7 and `phraseId` is the catalog join key — two different
 * things, which is the whole point. They used to be the same string, so a learner's row
 * carried the content team's id: no learner-authored phrase could have an id at all, and
 * two devices adding `cafe1` produced one row with interleaved fields.
 */
export function blankPhraseState(
  id: UserPhraseId,
  phraseId: CatalogPhraseId | null,
  source: PhraseState['source'],
  now: number,
): PhraseState {
  return {
    id,
    phraseId,
    source,
    difficulty: 'med',
    tags: [],
    loved: false,
    learned: false,
    note: null,
    plays: 0,
    reps: 0,
    addedAt: now,
    lastPracticedAt: null,
    graduatedAt: null,
    srs: null,
    repsToday: 0,
    repsTodayDay: null,
    automaticity: 0,
    lockInDays: 0,
    rung: LadderRung.Accumulated,
    stumbles: 0,
    cueLevel: 0,
    axPerception: 0,
    axRecall: 0,
    axProduction: 0,
  }
}

/** What the learner types (or imports, or photographs) when the phrase is their own. */
export interface OwnPhraseDraft {
  targetText: string
  translation: string
  theme?: Theme
  emoji?: string
}

/**
 * What a learner-authored phrase shows when its draft named no theme or emoji.
 *
 * One declaration, read from two places: `newOwnPhrase` resolves it at WRITE time so the
 * stored row is complete, and `toView` applies the same value at READ time for a row that
 * somehow lacks it. The two must agree — the same phrase rendering a different theme
 * depending on which path created it is the bug this constant prevents.
 */
export const OWN_PHRASE_FALLBACK: { readonly theme: Theme; readonly emoji: string } = {
  theme: 'Mine',
  emoji: '✍️',
}

/**
 * A row for a phrase with no catalog entry: `phraseId` is null and the text lives on
 * the row itself. This is the seam Import (`P2-09`, `P2-10`) and Capture plug into.
 */
export function newOwnPhrase(id: UserPhraseId, draft: OwnPhraseDraft, now: number): PhraseState {
  return {
    ...blankPhraseState(id, null, 'custom', now),
    ownEs: draft.targetText,
    ownEn: draft.translation,
    // Resolved once at write time so the stored row is complete rather than depending on
    // a render-time default. Same constant `toView` falls back to.
    ownTheme: draft.theme ?? OWN_PHRASE_FALLBACK.theme,
    ownEmoji: draft.emoji ?? OWN_PHRASE_FALLBACK.emoji,
  }
}
