import { describe, expect, it } from 'vitest'
import { bundledLyricDocument } from '@loro/core'
import { resolveMusicStylePacks } from '@loro/content'
import { ElevenLabsMusicAdapter, composeStyles, MUSIC_CONCURRENCY } from './music.js'

const document = bundledLyricDocument(
  [
    { id: 'cafe1', targetText: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
    { id: 'cafe2', targetText: '¿Tienen leche de avena?', translation: 'Do you have oat milk?' },
    { id: 'cafe3', targetText: 'Para llevar, por favor', translation: 'To go, please' },
  ],
  'es-ES',
  'en',
  1,
)

describe('elevenlabs music adapter fixtures (p3f-03)', () => {
  it('returns fixture wav bytes without calling the network', async () => {
    const adapter = new ElevenLabsMusicAdapter({
      provider: 'stub',
      fetchImpl: () => {
        throw new Error('network must not be used')
      },
    })
    const [pack] = resolveMusicStylePacks(['acoustic_folk'])
    const outcome = await adapter.compose(document, pack!)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.bytes.byteLength).toBeGreaterThan(40)
      expect(outcome.result.durationMs).toBe(400)
      expect(JSON.stringify(outcome.result.plan)).not.toContain(document.title.translation)
      expect(outcome.result.plan.chunks[0]?.text).toContain('[Verse 1]')
    }
    const cached = await adapter.compose(document, pack!)
    expect(cached.ok && cached.result.cached).toBe(true)
  })

  it('maps recorded failure fixtures and serializes styles at concurrency 2', async () => {
    const bad = new ElevenLabsMusicAdapter({ provider: 'stub', fixture: 'bad_prompt' })
    const truncated = new ElevenLabsMusicAdapter({ provider: 'stub', fixture: 'truncated' })
    const limited = new ElevenLabsMusicAdapter({ provider: 'stub', fixture: 'rate_limited' })
    const [pack] = resolveMusicStylePacks(['modern_pop'])
    expect((await bad.compose(document, pack!)).ok).toBe(false)
    expect((await truncated.compose(document, pack!)).ok).toBe(false)
    expect((await limited.compose(document, pack!)).ok).toBe(false)

    let active = 0
    let peak = 0
    const adapter = new ElevenLabsMusicAdapter({ provider: 'stub' })
    const original = adapter.compose.bind(adapter)
    adapter.compose = async (doc, style) => {
      active += 1
      peak = Math.max(peak, active)
      const result = await original(doc, style)
      active -= 1
      return result
    }
    const packs = resolveMusicStylePacks(['acoustic_folk', 'modern_pop', 'gentle_ballad'])
    const outcomes = await composeStyles(adapter, document, packs, MUSIC_CONCURRENCY)
    expect(outcomes).toHaveLength(3)
    expect(peak).toBeLessThanOrEqual(2)
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(3)
  })

  it('does not call ElevenLabs when MUSIC_PROVIDER is elevenlabs without a paid-smoke fixture', async () => {
    const adapter = new ElevenLabsMusicAdapter({
      provider: 'elevenlabs',
      apiKey: 'test-key',
      fetchImpl: () => {
        throw new Error('live elevenlabs must stay off')
      },
    })
    const [pack] = resolveMusicStylePacks(['gentle_ballad'])
    const outcome = await adapter.compose(document, pack!)
    expect(outcome).toEqual({ ok: false, failure: { kind: 'unavailable' } })
  })
})
