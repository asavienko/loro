import { describe, expect, it } from 'vitest'
import { phraseIdentityInvalid, phraseReplacementValid } from './phrase-identity.js'
import type { StoredRow } from './merge.js'

const upsert = {
  seq: 1,
  entity: 'user_phrase' as const,
  entity_id: 'row-a',
  op: 'upsert' as const,
  fields: {
    phraseId: { v: 'cafe1', hlc: '1:0000:a' },
    targetLocale: { v: 'es-ES' as const, hlc: '1:0000:a' },
    source: { v: 'starter' as const, hlc: '1:0000:a' },
    addedAt: { v: 1, hlc: '1:0000:a' },
  },
}

const existing: StoredRow = {
  entity: 'user_phrase',
  id: 'row-a',
  fields: {
    phraseId: { v: 'cafe1', hlc: { physical: 1, logical: 0, node_id: 'a' } },
    targetLocale: { v: 'es-ES', hlc: { physical: 1, logical: 0, node_id: 'a' } },
  },
  deleted_at: null,
}

describe('phrase identity', () => {
  it('rejects a first upsert that omits catalog identity', () => {
    expect(
      phraseIdentityInvalid({ ...upsert, fields: { reps: { v: 1, hlc: '1:0000:a' } } }, undefined),
    ).toBe(true)
    expect(phraseIdentityInvalid(upsert, undefined)).toBe(false)
  })

  it('rejects a later identity rewrite and an invalid replacement', () => {
    expect(
      phraseIdentityInvalid(
        { ...upsert, fields: { ...upsert.fields, phraseId: { v: 'other', hlc: '2:0000:a' } } },
        existing,
      ),
    ).toBe(true)
    expect(
      phraseReplacementValid(
        { ...upsert, replaces: { id: 'row-b', deleted_at: 9 } },
        existing,
        { ...existing, id: 'row-b', deleted_at: 8 },
        'row-b',
      ),
    ).toBe(false)
  })
})
