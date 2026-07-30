import { tokens as generatedTokens } from '@loro/design-tokens'
import { describe, expect, it } from 'vitest'
import {
  flattenGeneratedTokens,
  GENERATED_TOKEN_RECORDS,
  searchTokenRecords,
  TOKEN_GROUPS,
} from './tokens'

function primitiveLeafCount(value: unknown): number {
  if (Array.isArray(value)) {
    let count = 0
    for (const item of value as unknown[]) count += primitiveLeafCount(item)
    return count
  }
  if (typeof value === 'object' && value !== null) {
    let count = 0
    for (const child of Object.values(value) as unknown[]) count += primitiveLeafCount(child)
    return count
  }
  return 1
}

describe('dev token catalog', () => {
  it('DEV-TOKENS-01 renders or explicitly classifies every generated primitive leaf', () => {
    expect(Object.keys(TOKEN_GROUPS).sort()).toEqual(Object.keys(generatedTokens).sort())
    expect(GENERATED_TOKEN_RECORDS).toHaveLength(primitiveLeafCount(generatedTokens))
    expect(new Set(GENERATED_TOKEN_RECORDS.map((record) => record.path)).size).toBe(
      GENERATED_TOKEN_RECORDS.length,
    )
    expect(new Set(GENERATED_TOKEN_RECORDS.map((record) => record.classification))).toEqual(
      new Set(['visual', 'internal']),
    )
  })

  it('DEV-TOKENS-02 derives paths and values from the generated source', () => {
    const records = flattenGeneratedTokens(generatedTokens)
    expect(records.find((record) => record.path === 'surface.app')).toMatchObject({
      sourceGroup: 'surface',
      value: generatedTokens.surface.app,
      resolvedValue: generatedTokens.surface.app,
      classification: 'visual',
    })
    expect(records.find((record) => record.path === 'typography.scale.body.use')).toMatchObject({
      classification: 'internal',
    })
  })

  it('DEV-TOKENS-03 searches names, values, groups, uses, and classifications', () => {
    expect(searchTokenRecords('surface.app').map((record) => record.path)).toContain('surface.app')
    expect(searchTokenRecords('whole-product accent').length).toBeGreaterThan(0)
    expect(
      searchTokenRecords('internal').every((record) => record.classification === 'internal'),
    ).toBe(true)
  })
})
