/** Plan 113: Scribe's reply becomes heard words; nothing of the provider's leaks past a code. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProviderFailure } from '../integrations/provider-failure.js'
import {
  readScribe,
  scribeLanguage,
  transcribeSong,
  transcriptionConfigured,
} from './transcribe.js'

const reply = {
  language_code: 'spa',
  text: 'Tienen habitaciones libres',
  words: [
    { text: 'Tienen', start: 0.5, end: 0.9, type: 'word' },
    { text: ' ', start: 0.9, end: 1.0, type: 'spacing' },
    { text: 'habitaciones', start: 1.0, end: 1.8, type: 'word' },
    { text: '(music)', start: 1.8, end: 2.0, type: 'audio_event' },
    { text: 'libres', start: 2.0, end: 2.4, type: 'word' },
  ],
}

const song = { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'audio/mpeg', targetLang: 'es-ES' }
const urlOf = (url: string | URL | Request) =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url

describe('transcribeSong', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is on only with the music key, and may be turned off', () => {
    vi.stubEnv('MUSIC_PROVIDER', 'stub')
    expect(transcriptionConfigured()).toBe(false)
    vi.stubEnv('MUSIC_PROVIDER', 'elevenlabs')
    vi.stubEnv('MUSIC_API_KEY', 'k')
    expect(transcriptionConfigured()).toBe(true)
    vi.stubEnv('MUSIC_TRANSCRIBE', '0')
    expect(transcriptionConfigured()).toBe(false)
  })

  it('reads only the words, in milliseconds, in order', () => {
    expect(readScribe(reply)).toEqual([
      { text: 'Tienen', startMs: 500, endMs: 900 },
      { text: 'habitaciones', startMs: 1000, endMs: 1800 },
      { text: 'libres', startMs: 2000, endMs: 2400 },
    ])
    expect(() => readScribe({ text: 'x' })).toThrow(ProviderFailure)
    expect(() => readScribe({ words: [{ text: 'a', start: 2, end: 1 }] })).toThrow(ProviderFailure)
    expect(() =>
      readScribe({
        words: [
          { text: 'a', start: 2, end: 3 },
          { text: 'b', start: 1, end: 2 },
        ],
      }),
    ).toThrow(ProviderFailure)
  })

  it('sends the song as a file with the model, the language and word timestamps, under the key', async () => {
    vi.stubEnv('MUSIC_PROVIDER', 'elevenlabs')
    vi.stubEnv('MUSIC_API_KEY', 'secret-key')
    let seen: { url: string; headers: Record<string, string>; form: FormData } | undefined
    const send = ((url: string | URL | Request, init?: RequestInit) => {
      seen = {
        url: urlOf(url),
        headers: init?.headers as Record<string, string>,
        form: init?.body as FormData,
      }
      return Promise.resolve(Response.json(reply))
    }) as typeof fetch
    const words = await transcribeSong({ ...song, send })
    expect(words).toHaveLength(3)
    expect(seen?.url).toBe('https://api.elevenlabs.io/v1/speech-to-text')
    expect(seen?.headers['xi-api-key']).toBe('secret-key')
    expect(seen?.form.get('model_id')).toBe('scribe_v1')
    expect(seen?.form.get('language_code')).toBe('es')
    expect(seen?.form.get('timestamps_granularity')).toBe('word')
    expect((seen?.form.get('file') as Blob).type).toBe('audio/mpeg')
    expect(scribeLanguage('bg-BG')).toBe('bg')
  })

  it('fails with a code only', async () => {
    vi.stubEnv('MUSIC_PROVIDER', 'elevenlabs')
    vi.stubEnv('MUSIC_API_KEY', 'k')
    const refused = (() =>
      Promise.resolve(new Response('{"detail":"secret"}', { status: 429 }))) as typeof fetch
    await expect(transcribeSong({ ...song, send: refused })).rejects.toMatchObject({
      code: 'rate_limited',
    })
    const broken = (() => Promise.resolve(Response.json({ nope: true }))) as typeof fetch
    await expect(transcribeSong({ ...song, send: broken })).rejects.toMatchObject({
      code: 'invalid_output',
    })
  })
})
