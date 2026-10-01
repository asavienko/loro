import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { applyTranslateVerdicts, applyVerdicts, failuresOf, summarize } from './judge.js'
import { buildJudgeRequest, type JudgeInput, type RawVerdict } from './prompt/judge.js'
import type { RawTranslateVerdict } from './prompt/judge-translate.js'
import { loadPlanFile } from './slot.js'

const PLAN = fileURLToPath(
  new URL('../../../../packages/content/v2/plan/es/A1/eating-out.json', import.meta.url),
)

const ok: RawVerdict = {
  n: 1,
  natural: 'ok',
  english: 'ok',
  level: 'ok',
  grammar_claim: 'ok',
  glosses: 'ok',
  brief: 'ok',
  duplicate_of: 0,
  fix: '',
  note: '',
}
const inputs: JudgeInput[] = [
  { target: '¿Nos pone dos té con hielo?', english: 'Two iced teas?', words: [], grammar: [] },
  { target: '¿Me trae una servilleta?', english: 'A napkin?', words: [], grammar: [] },
  { target: 'Perdone, ¿me trae una servilleta?', english: 'A napkin?', words: [], grammar: [] },
]

describe('judge policy', () => {
  it('a wrong phrase rejects on its own; two other failures reject; one, or a minor, reviews', () => {
    expect(failuresOf({ ...ok, natural: 'wrong' }).critical).toBe(true)
    expect(failuresOf({ ...ok, english: 'wrong', glosses: 'wrong' }).critical).toBe(false)
    expect(failuresOf({ ...ok, brief: 'violates' }).critical).toBe(true)
    const verdicts = applyVerdicts(
      {
        verdicts: [
          { ...ok, n: 1, natural: 'wrong', fix: '¿Nos pone dos tés con hielo?' },
          { ...ok, n: 2, english: 'loose' },
          { ...ok, n: 3 },
        ],
      },
      inputs,
    )
    expect(verdicts.map((v) => v.outcome)).toEqual(['reject', 'review', 'ok'])
    const two = applyVerdicts(
      { verdicts: [{ ...ok, english: 'wrong', glosses: 'wrong' }] },
      inputs.slice(0, 1),
    )
    expect(two[0]?.outcome).toBe('reject')
    const one = applyVerdicts({ verdicts: [{ ...ok, glosses: 'wrong' }] }, inputs.slice(0, 1))
    expect(one[0]?.outcome).toBe('review')
    expect(verdicts[0]?.fix).toBe('¿Nos pone dos tés con hielo?')
    expect(summarize(verdicts)).toBe('1 ok, 1 review, 1 reject')
  })

  it('a duplicate is rejected on its own', () => {
    const verdicts = applyVerdicts(
      { verdicts: [ok, { ...ok, n: 2 }, { ...ok, n: 3, duplicate_of: 2 }] },
      inputs,
    )
    expect(verdicts[2]?.outcome).toBe('reject')
  })

  it('a missing verdict sends the phrase to review, never rejects it', () => {
    const verdicts = applyVerdicts({ verdicts: [ok, { ...ok, n: 1 }] }, inputs)
    expect(verdicts.map((v) => v.outcome)).toEqual(['ok', 'review', 'review'])
  })

  it('builds the same request twice and shows the judge the brief and every phrase', () => {
    const [slot] = loadPlanFile(PLAN)
    if (!slot) throw new Error('no slot')
    const a = buildJudgeRequest(slot, inputs, 'm')
    const b = buildJudgeRequest(slot, inputs, 'm')
    expect(a).toEqual(b)
    const text = a.messages[0]?.content ?? ''
    for (const p of inputs) expect(text).toContain(p.target)
    for (const g of slot.brief.grammarFocus) expect(text).toContain(g.rule)
    expect(text).toContain('Return exactly 3 verdicts')
    expect(buildJudgeRequest(slot, inputs.slice(0, 2), 'm').cacheKey).not.toBe(a.cacheKey)
  })

  it('translate judge: a wrong or unfaithful line rejects; a wrong gloss, loose or awkward reviews', () => {
    const tInputs = [1, 2, 3, 4].map((n) => ({
      target: `t${n}`,
      english: `e${n}`,
      translation: `l${n}`,
      glosses: [{ w: 'w', english: 'e', gloss: 'g' }],
    }))
    const base: Omit<RawTranslateVerdict, 'n'> = {
      faithful: 'ok',
      natural: 'ok',
      register: 'ok',
      glosses: 'ok',
      bad_glosses: [],
      fix: '',
      note: '',
    }
    const verdicts = applyTranslateVerdicts(
      {
        verdicts: [
          { ...base, n: 1, natural: 'wrong', fix: 'fixed' },
          { ...base, n: 2, glosses: 'wrong', bad_glosses: ['w'] },
          { ...base, n: 3, faithful: 'loose', register: 'off' },
          { ...base, n: 4 },
        ],
      },
      tInputs,
    )
    expect(verdicts.map((v) => v.outcome)).toEqual(['reject', 'review', 'review', 'ok'])
    expect(verdicts[1]?.failures[0]).toContain('glosses: wrong (w)')
    const two = applyTranslateVerdicts(
      { verdicts: [{ ...base, n: 1, glosses: 'wrong', bad_glosses: ['w'], faithful: 'wrong' }] },
      tInputs.slice(0, 1),
    )
    expect(two[0]?.outcome).toBe('reject')
  })
})
