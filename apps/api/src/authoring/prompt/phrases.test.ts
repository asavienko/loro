import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { loadContext } from '../context.js'
import { loadPlanFile } from '../slot.js'
import { buildPhrasesRequest, describe as size, examplesFor } from './phrases.js'

const PLAN = fileURLToPath(
  new URL('../../../../../packages/content/v2/plan/es/A1/eating-out.json', import.meta.url),
)
const MODEL = 'test-model'

describe('buildPhrasesRequest', () => {
  const slots = loadPlanFile(PLAN)
  const context = loadContext('es-ES')
  const [first, second] = slots
  if (!first || !second) throw new Error('the plan needs two slots')

  it('builds the same bytes for the same slot and context', () => {
    const a = buildPhrasesRequest(first, context, MODEL)
    const b = buildPhrasesRequest(first, loadContext('es-ES'), MODEL)
    expect(a).toEqual(b)
    expect(a.cacheKey).toBe(b.cacheKey)
  })

  it('builds different requests for two slots of one situation', () => {
    const a = buildPhrasesRequest(first, context, MODEL)
    const b = buildPhrasesRequest(second, context, MODEL)
    expect(a.cacheKey).not.toBe(b.cacheKey)
    expect(a.messages[0]?.content).not.toBe(b.messages[0]?.content)
  })

  it('changes the cache key when the brief, the model or a prior attempt changes', () => {
    const base = buildPhrasesRequest(first, context, MODEL)
    const edited = { ...first, brief: { ...first.brief, scene: `${first.brief.scene} At night.` } }
    expect(buildPhrasesRequest(edited, context, MODEL).cacheKey).not.toBe(base.cacheKey)
    expect(buildPhrasesRequest(first, context, 'other-model').cacheKey).not.toBe(base.cacheKey)
    const prior = { rejected: [{ target: 'x', reason: 'y' }], missing: ['zumo'], needed: 3 }
    expect(buildPhrasesRequest(first, context, MODEL, prior).cacheKey).not.toBe(base.cacheKey)
  })

  it('tells the model everything the brief holds, within the budget', () => {
    const request = buildPhrasesRequest(first, context, MODEL)
    const text = request.messages[0]?.content ?? ''
    for (const l of first.brief.mustUse) expect(text).toContain(l.lemma)
    for (const l of first.brief.avoid.lemmas) expect(text).toContain(l)
    for (const g of first.brief.grammarFocus) expect(text).toContain(g.rule)
    for (const m of first.brief.doNotMention) expect(text).toContain(m)
    expect(text).toContain('Me pone un cortado, por favor') // a sibling from set-cafe
    expect(size(request).approxTokens).toBeLessThan(4_500)
  })

  it('picks hand-written examples of the course, never from the slot itself', () => {
    const examples = examplesFor(first, context)
    expect(examples).toHaveLength(3)
    for (const e of examples) {
      expect(e.setId).not.toBe(first.setId)
      expect(e.words).toBeDefined()
    }
  })

  it('matches the reviewed snapshot (hand-written content only, so batches do not churn it)', async () => {
    const request = buildPhrasesRequest(first, loadContext('es-ES', { shards: false }), MODEL)
    await expect(
      `${request.system}\n\n---\n\n${request.messages[0]?.content ?? ''}`,
    ).toMatchFileSnapshot('./__snapshots__/phrases.set-es-a1-cafe-counter.txt')
  })
})
