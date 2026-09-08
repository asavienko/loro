import { describe, expect, it } from 'vitest'
import { PushResponseSchema, rowIdFor } from './sync.js'
describe('course and catalog sync identities (F-04)', () => {
  it('keeps legacy Spanish days readable and gives each target its own day identity', () => {
    const schema = rowIdFor('refrain_day')
    for (const id of ['2026-09-08', 'es-ES:2026-09-08', 'bg-BG:2026-09-08', 'ru-RU:2026-09-08'])
      expect(schema.safeParse(id).success).toBe(true)
    for (const id of ['en:2026-09-08', 'es-ES:2026-02-30', '2026-09-08:es-ES', 'es-ES:'])
      expect(schema.safeParse(id).success).toBe(false)
    expect(rowIdFor('streak_day').safeParse('es-ES:2026-09-08').success).toBe(false)
  })
  it('validates canonical alias IDs while accepting older responses without aliases', () => {
    const response = {
      accepted: [],
      rejected: [],
      conflicts: [],
      server_hlc: '1000:0000:server',
      server_time: 1000,
    }
    expect(PushResponseSchema.safeParse(response).success).toBe(true)
    expect(
      PushResponseSchema.safeParse({
        ...response,
        aliases: [{ from: 'caller-controlled', to: 'other' }],
      }).success,
    ).toBe(false)
  })
})
