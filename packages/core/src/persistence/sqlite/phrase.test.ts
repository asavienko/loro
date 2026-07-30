/**
 * The `user_phrase` column↔parameter contract, with no database in sight.
 *
 * `apps/mobile/src/data/persistence.test.ts` round-trips these rows through real SQLite,
 * which is the test that matters — but it can only run where `node:sqlite` is, and it
 * proves the mapping is self-consistent rather than proving it is ALIGNED. A parameter
 * list one item short binds every later column to its neighbour's value, and SQLite will
 * happily store it.
 */

import { describe, expect, it } from 'vitest'
import { PHRASE_COLUMN_NAMES, phraseToParams, rowToPhrase } from './phrase.js'
import type { SqlRow, SqlValue } from '../driver.js'
import { makePhrase } from '../../testing/index.js'
import { LadderRung } from '../../domain/phrase.js'
import { userPhraseId } from '../../domain/ids.js'

/** What the driver would hand back after the INSERT this file writes. */
function asRow(params: readonly SqlValue[]): SqlRow {
  return Object.fromEntries(PHRASE_COLUMN_NAMES.map((name, i) => [name, params[i] ?? null]))
}

describe('user_phrase column mapping', () => {
  it('binds exactly one parameter per column', () => {
    const params = phraseToParams(makePhrase('cafe1'), 'local', 'hlc-1')
    expect(params).toHaveLength(PHRASE_COLUMN_NAMES.length)
  })

  it('lists the columns the schema actually declares, in schema order', () => {
    // Sampled at the boundaries of each group in the DDL — enough to catch a column
    // inserted in the middle without its parameter.
    expect(PHRASE_COLUMN_NAMES[0]).toBe('id')
    expect(PHRASE_COLUMN_NAMES[7]).toBe('source')
    expect(PHRASE_COLUMN_NAMES.at(-1)).toBe('deleted_at')
    expect(new Set(PHRASE_COLUMN_NAMES).size, 'no column listed twice').toBe(
      PHRASE_COLUMN_NAMES.length,
    )
  })

  it('round-trips every field through the parameter order', () => {
    const phrase = {
      ...makePhrase('cafe1', {
        difficulty: 'hard' as const,
        tags: ['pron', 'useful'] as const,
        loved: true,
        plays: 3,
        reps: 7,
        repsToday: 4,
        repsTodayDay: '2026-07-28',
        automaticity: 67,
        lockInDays: 2,
        rung: LadderRung.PressureTested,
        stumbles: 1,
        cueLevel: 2,
        lastPracticedAt: 1_785_231_660_000,
      }),
      id: userPhraseId('row-1'),
      note: 'sounds like "coffee"',
      srs: {
        stability: 3.5,
        difficulty: 6.25,
        due: 1_785_318_060_000,
        lastReview: 1_785_231_660_000,
        lapses: 1,
        state: 'review' as const,
      },
      axPerception: 10,
      axRecall: 20,
      axProduction: 30,
    }

    // If a parameter slipped by one, some field below reads its neighbour's value.
    expect(rowToPhrase(asRow(phraseToParams(phrase, 'local', 'hlc-1')))).toEqual(phrase)
  })

  it('keeps a phrase with no FSRS run as null, not a fabricated schedule', () => {
    const back = rowToPhrase(asRow(phraseToParams(makePhrase('x'), 'local', 'hlc-1')))
    expect(back.srs).toBeNull()
  })
})
