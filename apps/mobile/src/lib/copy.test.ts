import { describe, expect, it } from 'vitest'
import { BROWSABLE_THEMES, DIFFICULTIES, MASTERY_BUCKETS, REFRAIN_MODES, TAGS } from '@loro/core'
import { copy } from './copy'

describe('semantic copy maps', () => {
  it('covers every closed domain key', () => {
    expect(Object.keys(copy.difficulty)).toEqual(DIFFICULTIES)
    expect(Object.keys(copy.tags)).toEqual(TAGS)
    expect(Object.keys(copy.mastery)).toEqual(MASTERY_BUCKETS)
    expect(Object.keys(copy.add.themes)).toEqual(BROWSABLE_THEMES)
    expect(Object.keys(copy.refrain.mic)).toEqual(REFRAIN_MODES)
    expect(Object.keys(copy.refrain.effort)).toEqual(['ready', 'cold', 'warm', 'hot', 'peak'])
  })
})
