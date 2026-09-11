import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  defaultStyleIds,
  fetchMusicStatus,
  musicGenerationBlocked,
  musicTrackContentUrl,
  musicTrackIdFromContentUrl,
  renderLocalStyles,
  requestLocalLyrics,
  requestMusicLyrics,
} from './client'
import { FIXTURE_WAV_DURATION_MS } from './wav'

const root = dirname(fileURLToPath(import.meta.url))

describe('device music stub (p3f-03 / p3f-06)', () => {
  it('builds a bundled lyric document that covers the selected catalog ids', () => {
    const lyrics = requestLocalLyrics(['cafe1', 'cafe2', 'cafe3'], 'es-ES', 'en')
    expect(lyrics.fallback).toBe(true)
    expect(lyrics.document.phrase_ids).toEqual(['cafe1', 'cafe2', 'cafe3'])
    expect(lyrics.document.used_phrases).toHaveLength(3)
  })

  it('can mark the same document as a validated stub for lyric review', () => {
    const lyrics = requestLocalLyrics(['cafe1', 'cafe2', 'cafe3'], 'es-ES', 'en', {
      fallback: false,
    })
    expect(lyrics.fallback).toBe(false)
  })

  it('renders fixture tracks, partial success, and unavailable without network uris', () => {
    const ready = renderLocalStyles(defaultStyleIds(), 'ok')
    expect(ready).toHaveLength(3)
    expect(ready.map((track) => track.uri ?? '')).toEqual([
      expect.stringMatching(/^data:audio\/wav;/),
      expect.stringMatching(/^data:audio\/wav;/),
      expect.stringMatching(/^data:audio\/wav;/),
    ])
    expect(ready[0]?.durationMs).toBe(FIXTURE_WAV_DURATION_MS)

    const partial = renderLocalStyles(defaultStyleIds(), 'partial')
    expect(partial.filter((track) => track.status === 'ready')).toHaveLength(2)
    expect(partial.at(-1)?.status).toBe('failed')

    const unavailable = renderLocalStyles(defaultStyleIds(), 'unavailable')
    expect(
      unavailable.every((track) => track.uri === null && track.errorCode === 'unavailable'),
    ).toBe(true)
  })

  it('blocks generation when offline unless a fixture is driving the journey', () => {
    expect(musicGenerationBlocked(false, undefined)).toBe(true)
    expect(musicGenerationBlocked(true, undefined)).toBe(false)
    expect(musicGenerationBlocked(false, 'playing')).toBe(false)
    expect(musicGenerationBlocked(true, 'unavailable')).toBe(true)
  })
})

describe('music API client', () => {
  it('reads public status and rewrites a loopback track URL', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ready: true, provider: 'stub' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(fetchMusicStatus('http://127.0.0.1:3001/v1', send)).resolves.toEqual({
      ready: true,
      provider: 'stub',
    })
    expect(musicTrackContentUrl('http://10.0.2.2:3001/v1', 'track_folk')).toBe(
      'http://10.0.2.2:3001/v1/music/tracks/track_folk/content',
    )
    expect(
      musicTrackIdFromContentUrl('http://10.0.2.2:3001/v1/music/tracks/track_folk/content'),
    ).toBe('track_folk')
  })

  it('maps a 429 lyrics response to quota instead of a generic unavailable error', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }))
    await expect(
      requestMusicLyrics(
        {
          catalogPhraseIds: ['cafe1', 'cafe2', 'cafe3'],
          targetLocale: 'es-ES',
          meaningLanguage: 'en',
        },
        'http://127.0.0.1:3001/v1',
        null,
        send,
      ),
    ).rejects.toMatchObject({ name: 'MusicClientError', code: 'quota' })
  })
})

describe('music privacy canary (p3d-14 / p3f-08)', () => {
  it('does not import applyDelta or mention capture/ASR/conditioning', () => {
    const files = ['client.ts', 'selection.ts', 'wav.ts', '../../../app/music.tsx']
    for (const file of files) {
      const src = readFileSync(join(root, file), 'utf8')
      expect(src, file).not.toMatch(
        /applyDelta|conditioning_ref|AudioRefChunk|voiceClone|speech-to-speech|pcmHandle/i,
      )
    }
  })
})
