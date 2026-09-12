import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LoroError } from './errors.js'
import { parseContract } from './parse.js'

const Sample = z.object({ id: z.string() })

describe('parseContract', () => {
  it('returns the parsed value', () => {
    expect(parseContract(Sample, { id: 'phrase-1' })).toEqual({ id: 'phrase-1' })
  })

  it('throws VALIDATION_FAILED with an optional detail', () => {
    expect(() => parseContract(Sample, { id: 1 }, 'Invalid sample.')).toThrow(LoroError)
    try {
      parseContract(Sample, {})
    } catch (error) {
      expect(error).toBeInstanceOf(LoroError)
      expect((error as LoroError).code).toBe('VALIDATION_FAILED')
      expect((error as LoroError).message).toBe('Request failed validation')
    }
  })
})
