/**
 * THE test that makes sync safe.
 *
 * Adding a field to a syncable entity without deciding how it merges is a silent
 * data-loss bug. This turns it into a build failure.
 *
 * See docs/architecture/sync-protocol.md#per-field-lww
 */

import { describe, expect, it } from 'vitest'
import { FIELD_POLICY, mergeClassFor, type SyncEntity } from './fieldPolicy.js'
import { makePhrase } from '../testing/index.js'

/** Fields that exist on PhraseState but are deliberately client-only. */
const NOT_SYNCED = new Set(['id'])

describe('field policy', () => {
  it('declares a merge class for every field on user_phrase', () => {
    const phrase = makePhrase('x')
    const declared = new Set(Object.keys(FIELD_POLICY.user_phrase))

    // PhraseState uses camelCase; the policy mirrors it.
    const missing = Object.keys(phrase)
      .filter((k) => !NOT_SYNCED.has(k))
      .filter(
        (k) => k !== 'srs' && k !== 'axPerception' && k !== 'axRecall' && k !== 'axProduction',
      )
      .filter((k) => !declared.has(k))

    expect(
      missing,
      `these PhraseState fields have no declared merge class — see docs/architecture/sync-protocol.md`,
    ).toEqual([])
  })

  it('covers the FSRS group and the prosody axes', () => {
    for (const f of ['srsStability', 'srsDifficulty', 'srsDue', 'srsLastReview']) {
      expect(mergeClassFor('user_phrase', f), f).toBe('latest-review')
    }
    for (const f of ['axPerception', 'axRecall', 'axProduction']) {
      expect(mergeClassFor('user_phrase', f), f).toBe('max')
    }
  })

  it('uses max — not lww — for every monotonic counter', () => {
    // LWW on a counter lets a device with a later clock but a LOWER value win.
    // Device A at reps:20 offline; device B reaches 18 later. LWW loses two reps.
    for (const f of ['reps', 'plays', 'rung', 'lockInDays', 'lastPracticedAt']) {
      expect(mergeClassFor('user_phrase', f), `${f} must be 'max'`).toBe('max')
    }
  })

  it('marks deletes as tombstones so they beat concurrent edits', () => {
    expect(mergeClassFor('user_phrase', 'deletedAt')).toBe('tombstone')
    expect(mergeClassFor('trip', 'deletedAt')).toBe('tombstone')
  })

  it('treats every log as append-only', () => {
    const logs: SyncEntity[] = ['review_log', 'latency_sample', 'take', 'session', 'attempt']
    for (const e of logs) {
      expect(mergeClassFor(e, 'anything'), e).toBe('append-only')
    }
  })

  it('resolves the learner signals as last-write-wins', () => {
    for (const f of ['difficulty', 'tags', 'loved', 'learned', 'note']) {
      expect(mergeClassFor('user_phrase', f), f).toBe('lww')
    }
  })

  it('returns undefined for an unknown field on a non-wildcard entity', () => {
    expect(mergeClassFor('user_phrase', 'somethingNew')).toBeUndefined()
  })

  it('declares a policy for every syncable entity', () => {
    const entities: SyncEntity[] = [
      'user_phrase',
      'trip',
      'trip_drop',
      'trip_phrase',
      'settings',
      'refrain_day',
      'streak_day',
      'review_log',
      'latency_sample',
      'take',
      'session',
      'attempt',
    ]
    for (const e of entities) {
      expect(Object.keys(FIELD_POLICY[e]).length, e).toBeGreaterThan(0)
    }
  })
})
