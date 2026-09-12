import { describe, expect, it } from 'vitest'
import { AUDIO_QUEUE_LISTENING, AUDIO_QUEUE_REFERENCE, gapPriority } from './gapPriority.js'
import { loadCatalog } from './index.js'

describe('gap_priority generate queue', () => {
  it('lists arc orphans, thin scenarios, short packs and missing audio without publishing', () => {
    const catalog = loadCatalog()
    const before = catalog.phrases.length
    const report = gapPriority(catalog)

    expect(report.orphans).toContain('cafe1')
    expect(report.orphans).not.toContain('din1')
    expect(report.orphans).not.toContain('din2')
    expect(new Set(report.orphans).size).toBe(report.orphans.length)
    expect(report.orphans).toEqual([...report.orphans].sort())

    expect(report.thinScenarios).toEqual([])
    expect(report.shortPacks.some((pack) => pack.id === 'cafe' && pack.actual < pack.target)).toBe(
      true,
    )
    expect(report.missingAudio).toHaveLength(catalog.phrases.length)
    expect(report.missingAudio[0]?.enqueue).toEqual([AUDIO_QUEUE_REFERENCE, AUDIO_QUEUE_LISTENING])
    expect(report.drafts).toEqual([])
    expect(loadCatalog().phrases.length).toBe(before)
  })

  it('emits plan-97 drafts for phrase gaps and still does not merge the catalog', () => {
    const catalog = structuredClone(loadCatalog())
    catalog.scenarios = catalog.scenarios.map((row) =>
      row.id === 'dinner' ? { ...row, phrases: row.phrases.slice(0, 2) } : row,
    )
    const report = gapPriority(catalog, { emitDrafts: true })
    expect(report.thinScenarios.map((row) => row.id)).toContain('dinner')
    expect(report.drafts.length).toBeGreaterThan(0)
    expect(report.drafts.map((draft) => draft.topic)).toContain('scenario:dinner')
    expect(report.drafts.map((draft) => draft.topic)).toContain('orphan:cafe1')
    expect(report.drafts.some((draft) => draft.topic === 'orphan:din1')).toBe(false)
    expect(loadCatalog().scenarios.find((row) => row.id === 'dinner')?.phrases).toHaveLength(4)
  })
})
