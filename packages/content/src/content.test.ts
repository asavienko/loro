import { describe, expect, it } from 'vitest'
import { BROWSABLE_THEMES } from '@loro/core'
import phraseSchema from '../schema/phrase.schema.json' with { type: 'json' }
import { loadCatalog, stressedSyllables, THEMES, wordCount } from './index.js'
import { ALL_CHECKS, runChecks, runChecksForCatalog, type Issue } from './checks.js'
import { loadCatalogFromDisk } from './fs.js'

const catalog = loadCatalog()
const errors = (issues: Issue[]): Issue[] => issues.filter((i) => i.level === 'error')

describe('catalog integrity', () => {
  it('has no validation errors', () => {
    const bad = errors(runChecks())
    expect(
      bad.map((i) => `${i.check}/${i.id ?? '-'}: ${i.message}`),
      'content errors block the build — see docs/process/content-authoring.md',
    ).toEqual([])
  })

  it('loads the full seed catalog', () => {
    expect(catalog.phrases.length).toBeGreaterThanOrEqual(31)
    expect(catalog.scenarios).toHaveLength(5)
    expect(catalog.packs.length).toBeGreaterThanOrEqual(11)
  })

  it('covers all eight themes', () => {
    const used = new Set(catalog.phrases.map((p) => p.theme))
    for (const theme of THEMES) expect(used, theme).toContain(theme)
  })

  it('keeps the authoring schema and Browse on the same canonical themes', () => {
    expect(THEMES).toBe(BROWSABLE_THEMES)
    expect(phraseSchema.properties.theme.enum).toEqual(BROWSABLE_THEMES)
  })

  it('gives every phrase a stable id, Spanish, English, theme, and emoji', () => {
    for (const p of catalog.phrases) {
      expect(p.id, p.id).toMatch(/^[a-z0-9]{2,12}$/)
      expect(p.es.length, p.id).toBeGreaterThan(1)
      expect(p.en.length, p.id).toBeGreaterThan(1)
      expect(p.emoji.length, p.id).toBeGreaterThan(0)
    }
  })

  it('keeps Spanish punctuation, including the inverted marks', () => {
    const questions = catalog.phrases.filter((p) => p.es.endsWith('?'))
    expect(questions.length).toBeGreaterThan(0)
    for (const p of questions) {
      expect(p.es.startsWith('¿'), `${p.id}: '${p.es}' needs an opening ¿`).toBe(true)
    }
  })
})

describe('the pack count promise', () => {
  it('makes every pack label match its membership exactly', () => {
    for (const p of catalog.packs) {
      expect(p.promisedCount, `${p.id} label`).toBe(p.phrases.length)
      if (p.sub !== undefined) {
        const n = p.phrases.length
        expect(p.sub, `${p.id} sub`).toBe(`${n} phrase${n === 1 ? '' : 's'}`)
      }
    }
  })

  it('catches a pack that would lie to the learner', () => {
    const lying = structuredClone(catalog)
    lying.packs[0]!.promisedCount = 99
    expect(errors(ALL_CHECKS.packs!(lying)).length).toBeGreaterThan(0)
  })

  it('keeps draft packs out of onboarding', () => {
    for (const p of catalog.packs.filter((x) => x.draft === true)) {
      expect(p.onboarding, `${p.id} is draft`).toBe(false)
      expect(p.phrases, `${p.id} is draft`).toHaveLength(0)
    }
  })

  it('offers at least one onboarding pack per starter theme', () => {
    const onboarding = catalog.packs.filter((p) => p.onboarding)
    expect(onboarding.length).toBeGreaterThanOrEqual(6)
    for (const p of onboarding) expect(p.phrases.length, p.id).toBeGreaterThan(0)
  })
})

describe('scenarios', () => {
  it('resolves every phrase reference', () => {
    const ids = new Set(catalog.phrases.map((p) => p.id))
    for (const s of catalog.scenarios) {
      for (const ref of s.phrases) expect(ids, `${s.id} -> ${ref}`).toContain(ref)
    }
  })

  it('crosses themes — a scenario is a situation, not a category', () => {
    const byId = new Map(catalog.phrases.map((p) => [p.id, p]))
    const dinner = catalog.scenarios.find((s) => s.id === 'dinner')!
    const themes = new Set(dinner.phrases.map((id) => byId.get(id)!.theme))
    expect(themes.size, 'a dinner reservation needs Dining phrases AND a greeting').toBeGreaterThan(
      1,
    )
  })
})

describe('drop schedules', () => {
  it('never adds new phrases on the final day', () => {
    // Cramming the night before a flight produces anxiety, not retention.
    for (const [len, steps] of Object.entries(catalog.drops)) {
      const finalDay = steps.find((s) => s.day === 1)
      expect(finalDay, `${len}-day schedule`).toBeDefined()
      expect(finalDay!.pack, `${len}-day final day must be review-only`).toBeNull()
    }
  })

  it('teaches survival and airport before polish', () => {
    const twelve = catalog.drops['12']!
    const dayOf = (pack: string): number => twelve.find((s) => s.pack === pack)!.day
    // Days count DOWN to arrival, so an earlier drop has a higher day number.
    expect(dayOf('airport')).toBeGreaterThan(dayOf('cafe'))
    expect(dayOf('survival')).toBeGreaterThan(dayOf('local'))
  })

  it('resolves every pack it deals', () => {
    const packIds = new Set(catalog.packs.map((p) => p.id))
    for (const [len, steps] of Object.entries(catalog.drops)) {
      for (const s of steps) {
        if (s.pack !== null) expect(packIds, `${len}-day day ${s.day}`).toContain(s.pack)
      }
    }
  })

  it('unlocks drops in the morning, local time', () => {
    expect(catalog.dropRules.unlockHourLocal).toBe(6)
    expect(catalog.dropRules.noNewPhrasesOnFinalDay).toBe(true)
    expect(catalog.dropRules.missedDropsMergeForward).toBe(true)
  })
})

describe('enrichment fields', () => {
  it('marks a stressed syllable in every respelling', () => {
    const withResp = catalog.phrases.filter((p) => p.resp !== undefined)
    expect(withResp.length).toBeGreaterThan(0)
    for (const p of withResp) {
      expect(stressedSyllables(p.resp!).length, `${p.id}: '${p.resp!}'`).toBeGreaterThan(0)
    }
  })

  it('embeds the phrase verbatim in its example', () => {
    for (const p of catalog.phrases.filter((x) => x.example !== undefined)) {
      const core = p.es
        .replace(/^[¿¡]/, '')
        .replace(/[?!.]$/, '')
        .toLowerCase()
      expect(p.example!.es.toLowerCase(), `${p.id} example must contain the phrase`).toContain(core)
    }
  })

  it('gives word chips a `say` value when the text is a fragment', () => {
    for (const p of catalog.phrases.filter((x) => x.words !== undefined)) {
      for (const w of p.words!) {
        if (/^[¿¡]/.test(w.es) || /[?!,.]$/.test(w.es)) {
          expect(
            w.say,
            `${p.id}: chip '${w.es}' is tappable and must speak a real word`,
          ).toBeDefined()
        }
      }
    }
  })

  it('keeps A1/A2 phrases learnable in six reps', () => {
    for (const p of catalog.phrases) {
      const level = p.cefr ?? 'A1'
      if (level === 'A1' || level === 'A2') {
        expect(wordCount(p.es), `${p.id}: '${p.es}'`).toBeLessThanOrEqual(8)
      }
    }
  })

  it('writes memory hooks as mnemonics, not restatements', () => {
    for (const p of catalog.phrases.filter((x) => x.hint !== undefined)) {
      // A hook that merely repeats the English teaches nothing.
      expect(p.hint!.toLowerCase(), p.id).not.toBe(p.en.toLowerCase())
      expect(p.hint!.length, p.id).toBeGreaterThan(20)
    }
  })
})

describe('check helpers', () => {
  it('runs selected checks against a supplied catalog', () => {
    const bad = structuredClone(catalog)
    ;(bad.phrases[0] as { theme: string }).theme = 'Nonsense'

    expect(runChecksForCatalog(bad, ['theme'])).toEqual(ALL_CHECKS.theme!(bad))
  })

  it('flags a duplicate Spanish phrase', () => {
    const dup = structuredClone(catalog)
    dup.phrases.push({ ...dup.phrases[0]!, id: 'clone1' })
    expect(errors(ALL_CHECKS.duplicates!(dup)).length).toBeGreaterThan(0)
  })

  it('flags a broken reference', () => {
    const broken = structuredClone(catalog)
    broken.packs[0]!.phrases.push('doesNotExist')
    expect(errors(ALL_CHECKS.refs!(broken)).length).toBeGreaterThan(0)
  })

  it('flags an unknown theme', () => {
    const bad = structuredClone(catalog)
    ;(bad.phrases[0] as { theme: string }).theme = 'Nonsense'
    expect(errors(ALL_CHECKS.theme!(bad)).length).toBeGreaterThan(0)
  })

  it('flags a respelling with no stress marked', () => {
    const bad = structuredClone(catalog)
    bad.phrases[0]!.resp = 'all lower case with no caps'
    expect(errors(ALL_CHECKS.stress!(bad)).length).toBeGreaterThan(0)
  })

  it('flags a final-day drop that adds phrases', () => {
    const bad = structuredClone(catalog)
    bad.drops['12']!.find((s) => s.day === 1)!.pack = 'cafe'
    expect(errors(ALL_CHECKS.drops!(bad)).length).toBeGreaterThan(0)
  })

  it('flags a graph edge that does not resolve', () => {
    const broken = structuredClone(catalog)
    broken.graph.edges.push({
      from: 'din1',
      to: 'doesNotExist',
      relation: 'reply',
      weight: 50,
    })
    expect(errors(ALL_CHECKS.graph!(broken)).some((i) => i.message.includes('unknown'))).toBe(true)
  })

  it('flags a duplicate (from, to, relation)', () => {
    const dup = structuredClone(catalog)
    dup.graph.edges.push({ ...dup.graph.edges[0]! })
    expect(errors(ALL_CHECKS.graph!(dup)).some((i) => i.message.includes('duplicate'))).toBe(true)
  })

  it('flags a cross-locale or locale-prefixed edge in es-ES', () => {
    const bad = structuredClone(catalog)
    bad.graph.edges.push({
      from: 'bg-BG:din1',
      to: 'din2',
      relation: 'reply',
      weight: 50,
    })
    const messages = errors(ALL_CHECKS.graph!(bad)).map((i) => i.message)
    expect(messages.some((m) => m.includes('cross-locale') || m.includes('locale-prefixed'))).toBe(
      true,
    )
  })

  it('flags a prerequisite cycle', () => {
    const cyclic = structuredClone(catalog)
    cyclic.graph.edges.push(
      { from: 'din1', to: 'din2', relation: 'prerequisite', weight: 40 },
      { from: 'din2', to: 'din1', relation: 'prerequisite', weight: 40 },
    )
    expect(errors(ALL_CHECKS.graph!(cyclic)).some((i) => i.message.includes('cycle'))).toBe(true)
  })
})

describe('phrase relation graph', () => {
  it('seeds only scenario_next from the authored scenario arcs', () => {
    expect(catalog.graph.lang).toBe('es-ES')
    expect(catalog.graph.edges).toHaveLength(15)
    expect(new Set(catalog.graph.edges.map((e) => e.relation))).toEqual(new Set(['scenario_next']))
    const ids = new Set(catalog.phrases.map((p) => p.id))
    for (const edge of catalog.graph.edges) {
      expect(ids).toContain(edge.from)
      expect(ids).toContain(edge.to)
      expect(edge.weight).toBe(100)
    }
    const keys = new Set(catalog.graph.edges.map((e) => `${e.from}\0${e.to}\0${e.relation}`))
    for (const scenario of catalog.scenarios) {
      for (let i = 0; i < scenario.phrases.length - 1; i++) {
        const from = scenario.phrases[i]!
        const to = scenario.phrases[i + 1]!
        expect(keys, `${scenario.id}: ${from} → ${to}`).toContain(`${from}\0${to}\0scenario_next`)
      }
    }
  })

  it('exposes identical edges from the bundled snapshot and the disk loader', () => {
    expect(loadCatalogFromDisk().graph).toEqual(catalog.graph)
    expect(loadCatalog().graph).toEqual(catalog.graph)
  })
})

describe('word counting', () => {
  it('counts words, ignoring extra whitespace', () => {
    expect(wordCount('La cuenta, por favor')).toBe(4)
    expect(wordCount('  ¿Cuánto   cuesta?  ')).toBe(2)
  })
})
