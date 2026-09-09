import { describe, expect, it } from 'vitest'
import {
  LearningCatalogQuerySchema,
  LearningDiffQuerySchema,
  LearningPackQuerySchema,
} from './learning-content.js'

describe('F-04 current multilingual catalog queries', () => {
  it('retains defaults and decimal safe-integer versions', () => {
    expect(LearningCatalogQuerySchema.parse({})).toEqual({ target: 'es-ES', native: 'en' })
    expect(LearningDiffQuerySchema.parse({}).from).toBe('0')
    for (const from of ['0', '01', String(Number.MAX_SAFE_INTEGER)]) {
      expect(LearningDiffQuerySchema.safeParse({ from }).success).toBe(true)
    }
  })
  it('rejects malformed query values and unsupported pairs without coercion', () => {
    for (const from of ['-1', '1x', '1.5', '', '9007199254740992', ['1'], 1, null]) {
      expect(LearningDiffQuerySchema.safeParse({ from }).success).toBe(false)
    }
    for (const query of [
      { native: 'bg', target: 'bg-BG' },
      { native: 'ru', target: 'ru-RU' },
      { target: ['es-ES'] },
      { native: { value: 'en' } },
    ]) {
      expect(LearningCatalogQuerySchema.safeParse(query).success).toBe(false)
    }
    for (const id of [undefined, '', ['cafe'], { value: 'cafe' }]) {
      expect(LearningPackQuerySchema.safeParse({ id }).success).toBe(false)
    }
  })
})
