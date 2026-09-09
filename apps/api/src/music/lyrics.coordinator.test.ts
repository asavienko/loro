import { describe, expect, it } from 'vitest'
import { LyricsCoordinator, type LyricsModel } from './lyrics.coordinator.js'
import { LoroError } from '../common/errors.js'

const request = {
  target_locale: 'es-ES' as const,
  meaning_language: 'en' as const,
  catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
}

describe('lyrics coordinator (ai-05)', () => {
  it('serves the bundled floor under the stub model', async () => {
    const response = await new LyricsCoordinator().lyrics(request, 'user-a')
    expect(response.fallback).toBe(true)
    expect(response.provenance).toBe('bundled')
    expect(response.document.phrase_ids).toEqual(request.catalog_phrase_ids)
    expect(response.document.sections).toHaveLength(3)
    const cached = await new LyricsCoordinator().lyrics(request, 'user-a')
    expect(cached.cached).toBe(false)
  })

  it('rejects unknown, duplicate, and wrong-locale catalog ids', async () => {
    const coordinator = new LyricsCoordinator()
    await expect(
      coordinator.lyrics({ ...request, catalog_phrase_ids: ['cafe1', 'nope', 'cafe2'] }, 'user-a'),
    ).rejects.toBeInstanceOf(LoroError)
    await expect(
      coordinator.lyrics({ ...request, catalog_phrase_ids: ['cafe1', 'cafe1', 'cafe2'] }, 'user-a'),
    ).rejects.toBeInstanceOf(LoroError)
    await expect(
      coordinator.lyrics(
        { ...request, catalog_phrase_ids: ['bg-BG:cafe1', 'bg-BG:cafe2', 'bg-BG:cafe3'] },
        'user-a',
      ),
    ).rejects.toBeInstanceOf(LoroError)
  })

  it('repairs once then falls back when the model stays invalid', async () => {
    let calls = 0
    const model: LyricsModel = {
      propose: async () => {
        calls += 1
        return { invalid: true }
      },
    }
    const response = await new LyricsCoordinator(model).lyrics(request, 'user-a')
    expect(calls).toBe(2)
    expect(response.fallback).toBe(true)
    expect(response.provenance).toBe('bundled')
  })

  it('returns a cached validated document on the second identical request', async () => {
    const coordinator = new LyricsCoordinator()
    const first = await coordinator.lyrics(request, 'user-a')
    const second = await coordinator.lyrics(request, 'user-a')
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(second.lyric_document_id).toBe(first.lyric_document_id)
  })
})
