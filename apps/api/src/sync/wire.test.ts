import { describe, expect, it } from 'vitest'
import type { StoredRow } from './merge.js'
import { wireRow } from './wire.js'

describe('wireRow', () => {
  it('encodes live fields and omits learner text on a tombstone', () => {
    const live: StoredRow = {
      entity: 'user_phrase',
      id: '0197f2a0-0000-7000-8000-00000000000a',
      fields: {
        phraseId: { v: 'cafe1', hlc: { physical: 1, logical: 0, node_id: 'a' } },
        targetLocale: { v: 'es-ES', hlc: { physical: 1, logical: 0, node_id: 'a' } },
      },
      deleted_at: null,
    }
    const encoded = wireRow(live)
    expect(encoded.entity).toBe('user_phrase')
    expect(encoded.fields).toMatchObject({ phraseId: { v: 'cafe1', hlc: '1:0000:a' } })
    expect(wireRow({ ...live, deleted_at: 9 })).toMatchObject({
      entity_id: '0197f2a0-0000-7000-8000-00000000000a',
      deleted_at: 9,
      fields: {},
      catalog_identity: { phraseId: 'cafe1', targetLocale: 'es-ES' },
    })
  })
})
