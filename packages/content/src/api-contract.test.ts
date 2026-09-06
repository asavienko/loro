import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CatalogPhraseSchema } from '@loro/core/api/catalog'
import { CatalogResponsePhraseSchema } from '@loro/core/api/target'
import { loadCatalog } from './index.js'

describe('catalog/API compatibility (F-04)', () => {
  it('validates every shipped phrase against strict authoring and tolerant response contracts', () => {
    for (const phrase of loadCatalog().phrases) {
      expect(CatalogPhraseSchema.parse(phrase)).toEqual(phrase)
      expect(
        CatalogResponsePhraseSchema.parse({ ...phrase, future_field: true })['future_field'],
      ).toBe(true)
    }
  })
  it('keeps the established JSON schema property surface, including regional variants', () => {
    const parsed: unknown = JSON.parse(
      readFileSync(new URL('../schema/phrase.schema.json', import.meta.url), 'utf8'),
    )
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('properties' in parsed) ||
      typeof parsed.properties !== 'object' ||
      parsed.properties === null
    )
      throw new Error('Missing catalog schema')
    expect(Object.keys(CatalogPhraseSchema.shape).sort()).toEqual(
      Object.keys(parsed.properties).sort(),
    )
  })
})
