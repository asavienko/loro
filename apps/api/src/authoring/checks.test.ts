import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { checkCandidate, containsLemma, jaccard, makeRoom, select } from './checks.js'
import { loadContext } from './context.js'
import type { RawCandidate } from './prompt/phrases.js'
import { loadPlanFile } from './slot.js'

const PLAN = fileURLToPath(
  new URL('../../../../packages/content/v2/plan/es/A1/eating-out.json', import.meta.url),
)

function candidate(target: string, over: Partial<RawCandidate> = {}): RawCandidate {
  const words = target
    .replace(/[¿?¡!,.]/g, '')
    .split(/\s+/)
    .map((w) => ({ w, gloss_en: 'x' }))
  return {
    target,
    en_GB: 'English',
    en_US: 'English',
    register: 'neutral',
    words,
    grammar: ['es-present-regular'],
    functions: ['request'],
    uses: [],
    icons: ['local_cafe'],
    ...over,
  }
}

describe('checks', () => {
  const [slot] = loadPlanFile(PLAN)
  if (!slot) throw new Error('no slot')
  const context = loadContext('es-ES')

  it('finds Polish lemmas through their case and verb endings', () => {
    const pl = (text: string, lemma: string, pos?: string) =>
      containsLemma(text, lemma, pos, 'pl-PL')
    expect(pl('Poproszę kawę z mlekiem', 'kawa')).toBe(true)
    expect(pl('Poproszę kawę z mlekiem', 'z mlekiem')).toBe(true)
    expect(pl('Czy mogę prosić o rachunek?', 'rachunek')).toBe(true)
    expect(pl('Proszę o rachunku nie mówić', 'rachunek')).toBe(true)
    expect(pl('Zapłacę kartą', 'karta')).toBe(true)
    expect(pl('Zapłacę kartą', 'zapłacić', 'verb')).toBe(true)
    expect(pl('Ile to kosztuje?', 'kosztować', 'verb')).toBe(true)
    expect(pl('Chcę wodę niegazowaną', 'woda niegazowana')).toBe(true)
    expect(pl('Chcę herbatę', 'chcieć', 'verb')).toBe(true)
    expect(pl('Chcę herbatę', 'chcieć')).toBe(true)
    expect(pl('Proszę cukier', 'prosić', 'verb')).toBe(true)
    expect(pl('Poproszę sok', 'kawa')).toBe(false)
    expect(pl('Na miejscu', 'na wynos')).toBe(false)
    expect(pl('Ty płacisz', 'płacić')).toBe(true)
    expect(pl('Coś na kaszel? Syrop od kaszlu', 'kaszel')).toBe(true)
    expect(pl('Czekam na dworcu', 'dworzec')).toBe(true)
  })

  it('finds lemmas as words, prefixes of long words, and multi-word units', () => {
    expect(containsLemma('Una tostada con tomate', 'tostada')).toBe(true)
    expect(containsLemma('Dos tostadas, por favor', 'tostada')).toBe(true)
    expect(containsLemma('Un café con leche para llevar', 'para llevar')).toBe(true)
    expect(containsLemma('Un té solo', 'solo')).toBe(true)
    expect(containsLemma('Un sol', 'solo')).toBe(false)
  })

  it('finds a verb by its stem, with the common stem changes', () => {
    expect(containsLemma('¿Nos cobra, por favor?', 'cobrar', 'verb')).toBe(true)
    expect(containsLemma('Hoy invito yo', 'invitar', 'verb')).toBe(true)
    expect(containsLemma('¿Se queda con el cambio?', 'quedarse', 'verb')).toBe(true)
    expect(containsLemma('Quiero un café', 'querer', 'verb')).toBe(true)
    expect(containsLemma('¿Puede repetir?', 'poder', 'verb')).toBe(true)
    expect(containsLemma('¿Me pide la cuenta?', 'pedir', 'verb')).toBe(true)
    expect(containsLemma('Vamos a desayunar', 'desayunar')).toBe(true)
    expect(containsLemma('Una tostada', 'cobrar', 'verb')).toBe(false)
  })

  it('accepts a good candidate and records what it really uses', () => {
    const c = checkCandidate(
      slot,
      candidate('¿Me pone un café con leche?', { uses: ['café con leche'] }),
      0,
      context,
      [],
    )
    expect(c.problems).toEqual([])
    expect(c.uses).toEqual(['café con leche'])
    expect(c.score).toBeGreaterThan(0)
  })

  it('rejects over the word limit, wrong script, banned words, false claims and bad glosses', () => {
    const long = checkCandidate(
      slot,
      candidate('Buenos días, me pone un café con leche y una tostada'),
      0,
      context,
      [],
    )
    expect(long.problems.join()).toContain('words')
    const cyr = checkCandidate(slot, candidate('Кафе, пожалуйста'), 0, context, [])
    expect(cyr.problems.join()).toContain('Latin')
    const banned = checkCandidate(slot, candidate('Un cortado, por favor'), 0, context, [])
    expect(banned.problems.join()).toContain('banned')
    const claim = checkCandidate(
      slot,
      candidate('Un té, por favor', { uses: ['azúcar'] }),
      0,
      context,
      [],
    )
    expect(claim.problems.join()).toContain('claims to use azúcar')
    const gloss = checkCandidate(
      slot,
      candidate('Un té, por favor', { words: [{ w: 'té', gloss_en: 'tea' }] }),
      0,
      context,
      [],
    )
    expect(gloss.problems.join()).toContain('`words`')
  })

  it('rejects what the course already has and what is too close to a sibling', () => {
    const dup = checkCandidate(slot, candidate('¿Tienen leche de avena?'), 0, context, [])
    expect(dup.problems.join()).toContain('already in the course')
    const near = checkCandidate(slot, candidate('¿Me pone un café solo, por favor?'), 0, context, [
      {
        id: 'x',
        target: '¿Me pone un café solo, por favor',
        english: '',
        level: 'A1',
        setId: 's',
        topicId: 't',
      },
    ])
    expect(near.problems.join()).toContain('too close')
  })

  it('selects by score, drops near-duplicates among the chosen and reports coverage', () => {
    const checked = [
      candidate('¿Me pone una tostada?', { uses: ['tostada'] }),
      candidate('¿Me pone una tostada, por favor?', { uses: ['tostada'] }),
      candidate('Un zumo para llevar', { uses: ['zumo', 'para llevar'] }),
      candidate('Gracias'),
    ].map((c, i) => checkCandidate(slot, c, i, context, []))
    const selection = select(slot, checked, 2)
    expect(selection.chosen.map((c) => c.candidate.target)).toEqual([
      'Un zumo para llevar',
      '¿Me pone una tostada?',
    ])
    expect(selection.missing).toContain('azúcar')
    expect(selection.coverage).toBeCloseTo(3 / 12)
    expect(jaccard(['a', 'b'], ['a', 'b', 'c'])).toBeCloseTo(2 / 3)
  })

  it('makes room by dropping phrases whose must-use words others already cover', () => {
    const checked = [
      candidate('¿Me pone una tostada?', { uses: ['tostada'] }),
      candidate('Dos tostadas, por favor', { uses: ['tostada'] }),
      candidate('Un zumo para llevar', { uses: ['zumo', 'para llevar'] }),
      candidate('Gracias'),
    ].map((c, i) => checkCandidate(slot, c, i, context, []))
    const kept = makeRoom(checked, 2)
    expect(kept.map((c) => c.candidate.target)).toEqual([
      '¿Me pone una tostada?',
      'Un zumo para llevar',
    ])
    expect(makeRoom(checked.slice(2, 3), 1)).toHaveLength(1)
  })
})
