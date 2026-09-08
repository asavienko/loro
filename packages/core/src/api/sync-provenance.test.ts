/** F-04: preserve old receipts while carrying verifiable scheduling evidence across devices. */
import { describe, expect, it } from 'vitest'
import { FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM } from '../domain/phrase.js'
import {
  ChangeSchema,
  PushOpSchema,
  ReviewLogFieldsSchema,
  UserPhraseFieldsSchema,
  fsrsFields,
  reviewLogJournalFields,
  validatePushBatch,
} from './sync.js'

const id = '0197a001-0000-7000-8000-000000000001'
const hlc = '1721558400123:0007:device_1'
const field = <T>(v: T) => ({ v, hlc })
const legacyState = {
  srsStability: field(1.5),
  srsDifficulty: field(5),
  srsDue: field(2000),
  srsLastReview: field(1000),
  srsLapses: field(0),
  srsState: field('review'),
}
const legacyLog = {
  phraseId: field(id),
  at: field(1000),
  grade: field('good'),
  stability: field(1.5),
  difficulty: field(5),
  due: field(2000),
}
const journal = {
  ...legacyLog,
  algorithm: field(FSRS_ALGORITHM),
  targetLocale: field('bg-BG'),
  lastReview: field(1000),
  lapses: field(0),
  state: field('review'),
}

describe('scheduling provenance compatibility', () => {
  it('preserves legacy operations without adding fields that would change receipt digests', () => {
    for (const [entity, fields] of [
      ['user_phrase', legacyState],
      ['review_log', legacyLog],
    ]) {
      const operation = { seq: 1, entity, entity_id: id, op: 'upsert', fields }
      const original = structuredClone(operation)
      expect(PushOpSchema.parse(operation)).toEqual(original)
      const classified = validatePushBatch({ client_hlc: hlc, ops: [operation] })
      expect(classified.rejected).toEqual([])
      expect(classified.valid).toEqual([original])
      expect(operation).toEqual(original)
    }
  })

  it('accepts known algorithm IDs only as part of the complete scheduling state', () => {
    for (const algorithm of [FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM]) {
      const complete = { ...legacyState, srsAlgorithm: field(algorithm) }
      expect(UserPhraseFieldsSchema.parse(complete)).toEqual(complete)
      for (const key of fsrsFields.filter((name) => name !== 'srsAlgorithm')) {
        const incomplete = Object.fromEntries(
          Object.entries(complete).filter(([name]) => name !== key),
        )
        expect(UserPhraseFieldsSchema.safeParse(incomplete).success, key).toBe(false)
      }
    }
    expect(UserPhraseFieldsSchema.safeParse({ srsAlgorithm: field(FSRS_ALGORITHM) }).success).toBe(
      false,
    )
    expect(
      UserPhraseFieldsSchema.safeParse({ ...legacyState, srsAlgorithm: field('unknown-policy') })
        .success,
    ).toBe(false)
  })

  it('keeps legacy and explicit provenance readable through pull without relabelling', () => {
    for (const fields of [legacyState, { ...legacyState, srsAlgorithm: field(FSRS_ALGORITHM) }]) {
      const change = { entity: 'user_phrase', entity_id: id, fields, deleted_at: null }
      expect(ChangeSchema.parse(change)).toEqual(change)
    }
  })
})

describe('review journal evidence', () => {
  it('retains already-attempted algorithm-only review logs without changing receipt input', () => {
    for (const algorithm of [FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM]) {
      const fields = { ...legacyLog, algorithm: field(algorithm) }
      const operation = { seq: 1, entity: 'review_log', entity_id: id, op: 'upsert', fields }
      const wire = JSON.stringify(operation)
      const parsed = PushOpSchema.parse(JSON.parse(wire))
      expect(parsed).toEqual(operation)
      expect(JSON.stringify(parsed)).toBe(wire)
      const classified = validatePushBatch({ client_hlc: hlc, ops: [JSON.parse(wire)] })
      expect(classified.rejected).toEqual([])
      expect(classified.valid).toEqual([operation])
      expect(JSON.stringify(classified.valid[0])).toBe(wire)
      const change = { entity: 'review_log', entity_id: id, fields, deleted_at: null }
      expect(ChangeSchema.parse(change)).toEqual(change)
    }
  })

  it('allows complete journal records for supported courses and known policies', () => {
    for (const algorithm of [FSRS_ALGORITHM, LEGACY_PREVIEW_ALGORITHM]) {
      for (const targetLocale of ['es-ES', 'bg-BG', 'ru-RU']) {
        const fields = {
          ...journal,
          algorithm: field(algorithm),
          targetLocale: field(targetLocale),
        }
        expect(ReviewLogFieldsSchema.parse(fields)).toEqual(fields)
        const change = { entity: 'review_log', entity_id: id, fields, deleted_at: null }
        expect(ChangeSchema.parse(change)).toEqual(change)
      }
    }
    expect(ReviewLogFieldsSchema.safeParse({ ...journal, lastReview: field(null) }).success).toBe(
      true,
    )
  })

  it('rejects incomplete journal extensions while retaining the original legacy log shape', () => {
    expect(ReviewLogFieldsSchema.parse(legacyLog)).toEqual(legacyLog)
    for (const key of reviewLogJournalFields) {
      const incomplete = Object.fromEntries(
        Object.entries(journal).filter(([name]) => name !== key),
      )
      expect(ReviewLogFieldsSchema.safeParse(incomplete).success, key).toBe(false)
      expect(ReviewLogFieldsSchema.safeParse({ ...legacyLog, [key]: journal[key] }).success).toBe(
        key === 'algorithm',
      )
    }
  })

  it('rejects unsupported provenance and invalid scheduling evidence', () => {
    for (const invalid of [
      { algorithm: field('invented-policy') },
      { targetLocale: field('de-DE') },
      { lastReview: field(-1) },
      { lapses: field(1.5) },
      { state: field('unrecognized') },
    ]) {
      expect(ReviewLogFieldsSchema.safeParse({ ...journal, ...invalid }).success).toBe(false)
    }
  })
})
