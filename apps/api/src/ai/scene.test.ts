/**
 * The scene invariants, tested directly.
 *
 * These used to be reachable only through `POST /ai/scene`, which meant the ONE case
 * that matters — an invalid scene being rejected — could not be tested at all: the
 * bundled scenes are valid, so no HTTP request can produce a rejection. A learner never
 * seeing two "best" options is the whole pedagogical payload of the roleplay screen
 * (ADR-0010), so it is worth asserting on the rule rather than on the fixture.
 */

import { describe, expect, it } from 'vitest'
import { bundledScene, bundledThemes } from './bundled-scenes.js'
import { validateScene, type Scene, type SceneTurn } from './scene.js'

const turn = (overrides: Partial<SceneTurn> = {}): SceneTurn => ({
  npc: { es: '¿Qué le pongo?', en: 'What can I get you?' },
  options: [
    { es: 'Un cortado, por favor.', en: 'A cortado, please.', best: true, tip: 'Short and local.' },
    { es: '¿Qué me recomienda?', en: 'What do you recommend?', tip: 'A friendly opener.' },
    { es: '¿Tienen leche de avena?', en: 'Do you have oat milk?', tip: 'A useful stretch.' },
  ],
  ...overrides,
})

const scene = (turns: SceneTurn[]): Scene => ({
  place: 'Café Central',
  city: 'Madrid',
  emoji: '☕',
  role: 'Camarero',
  turns,
  closer: { es: '¡Gracias!', en: 'Thanks!' },
})

describe('scene validation', () => {
  it('accepts a well-formed scene', () => {
    expect(validateScene(scene([turn()]))).toEqual({ ok: true })
  })

  it('accepts every bundled scene — the fallback must never be the thing that fails', () => {
    for (const theme of bundledThemes()) {
      expect(validateScene(bundledScene(theme)), theme).toEqual({ ok: true })
    }
  })

  it('rejects a scene with no turns', () => {
    expect(validateScene(scene([]))).toMatchObject({ ok: false, reason: 'no_turns' })
  })

  it('rejects two best options — the distinction is the point of the screen', () => {
    const t = turn()
    const options = t.options.map((o, i) => (i === 1 ? { ...o, best: true } : o))
    expect(validateScene(scene([turn({ options })]))).toMatchObject({
      ok: false,
      reason: 'best_count',
    })
  })

  it('rejects no best option at all', () => {
    const options = turn().options.map((o) => ({ ...o, best: false }))
    expect(validateScene(scene([turn({ options })]))).toMatchObject({
      ok: false,
      reason: 'best_count',
    })
  })

  it('rejects a turn that is not three options', () => {
    expect(validateScene(scene([turn({ options: turn().options.slice(0, 2) })]))).toMatchObject({
      ok: false,
      reason: 'option_count',
    })
  })

  it('rejects a tip too short to teach anything', () => {
    const options = turn().options.map((o, i) => (i === 0 ? { ...o, tip: 'Good.' } : o))
    expect(validateScene(scene([turn({ options })]))).toMatchObject({
      ok: false,
      reason: 'tip_missing',
    })
  })

  it('rejects an option too long to say out loud', () => {
    const es = Array.from({ length: 13 }, (_, i) => `palabra${i}`).join(' ')
    const options = turn().options.map((o, i) => (i === 0 ? { ...o, es } : o))
    expect(validateScene(scene([turn({ options })]))).toMatchObject({
      ok: false,
      reason: 'too_long',
    })
  })

  it('rejects duplicate options — a choice that is not a choice', () => {
    const [first] = turn().options
    const options = turn().options.map((o, i) => (i === 1 ? { ...o, es: first?.es ?? '' } : o))
    expect(validateScene(scene([turn({ options })]))).toMatchObject({
      ok: false,
      reason: 'duplicate_options',
    })
  })

  it('checks every turn, not just the first', () => {
    expect(validateScene(scene([turn(), turn({ options: [] })]))).toMatchObject({
      ok: false,
      reason: 'option_count',
    })
  })
})
