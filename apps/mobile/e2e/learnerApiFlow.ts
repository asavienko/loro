/**
 * Preview TTS / music / suggest traffic on the E2E account host.
 * Default TTS stays unavailable so Stream keeps its no-play assertions.
 */
import { createHash } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import { FIXTURE_WAV_DURATION_MS, silentWavBytes } from '../src/lib/music/wav'

const wav = silentWavBytes()
const wavSha = createHash('sha256').update(wav).digest('hex')
/** Long enough that Stream E2E can pin pause bars before the fixture ends. */
const TTS_PLAY_MS = 8_000
const ttsWav = silentWavBytes(TTS_PLAY_MS)
const ttsWavSha = createHash('sha256').update(ttsWav).digest('hex')
const ttsReady = new WeakMap<object, boolean>()

export function mockTtsStatus(page: Page, ready: boolean): void {
  ttsReady.set(page.context(), ready)
}

export function learnerTtsReady(page: Page): boolean {
  return ttsReady.get(page.context()) === true
}

export async function fulfillLearnerPreview(
  route: Route,
  page: Page,
  path: string,
  method: string,
  body: unknown,
): Promise<boolean> {
  if (path.endsWith('/tts/status')) {
    const ready = learnerTtsReady(page)
    await route.fulfill({
      json: { ready, provider: ready ? 'elevenlabs' : 'stub' },
    })
    return true
  }
  if (method === 'POST' && path.endsWith('/tts/render')) {
    if (!learnerTtsReady(page)) {
      await route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
      return true
    }
    const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const hash =
      typeof record['phrase_hash'] === 'string' && /^[a-f0-9]{64}$/.test(record['phrase_hash'])
        ? record['phrase_hash']
        : ttsWavSha
    const voice =
      typeof record['voice_id'] === 'string' && record['voice_id'].length > 0
        ? record['voice_id']
        : 't9LRTh3y1ioN00e9wsNh'
    const model =
      typeof record['model_id'] === 'string' && record['model_id'].length > 0
        ? record['model_id']
        : 'eleven_multilingual_v2'
    await route.fulfill({
      json: {
        uri: `sha256/${hash}`,
        sha256: hash,
        ms: TTS_PLAY_MS,
        cached: true,
        download_url: `https://auth.loro.test/v1/tts/assets/${hash}`,
        voice_id: voice,
        model_id: model,
        asset_class: 'reference',
      },
    })
    return true
  }
  if (method === 'GET' && /\/tts\/assets\/[a-f0-9]{64}$/.test(path)) {
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: Buffer.from(ttsWav),
    })
    return true
  }
  if (path.endsWith('/music/status')) {
    await route.fulfill({ json: { ready: true, provider: 'stub' } })
    return true
  }
  if (method === 'POST' && path.endsWith('/phrases/suggest')) {
    // Preview stub: no live rows. `unavailable` keeps the client's bundled topics
    // (empty `bundled` would hide "Suggested for this" in Discover).
    await route.fulfill({
      json: { fallback: true, provenance: 'unavailable', candidates: [] },
    })
    return true
  }
  if (method === 'POST' && path.endsWith('/music/lyrics')) {
    await route.fulfill({ json: stubMusicLyrics(body) })
    return true
  }
  if (method === 'POST' && path.endsWith('/music/renders')) {
    await route.fulfill({ json: stubMusicRenders(body) })
    return true
  }
  const track = /^\/v1\/music\/tracks\/([A-Za-z0-9_-]+)(\/content)?$/.exec(path)
  if (track !== null && method === 'GET') {
    const trackId = track[1] ?? 'track'
    if (track[2] === '/content') {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: Buffer.from(wav),
      })
      return true
    }
    await route.fulfill({
      json: {
        track_id: trackId,
        style_id: styleFromTrackId(trackId),
        sha256: wavSha,
        byte_length: wav.byteLength,
        duration_ms: FIXTURE_WAV_DURATION_MS,
        content_type: 'audio/wav',
        generated: true,
        download_path: `/music/tracks/${trackId}/content`,
      },
    })
    return true
  }
  return false
}

function stubMusicLyrics(body: unknown): Record<string, unknown> {
  const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const ids = Array.isArray(record['catalog_phrase_ids'])
    ? record['catalog_phrase_ids'].filter((id): id is string => typeof id === 'string')
    : ['cafe1', 'cafe2', 'cafe3']
  const locale = typeof record['target_locale'] === 'string' ? record['target_locale'] : 'es-ES'
  const meaning = typeof record['meaning_language'] === 'string' ? record['meaning_language'] : 'en'
  return {
    lyric_document_id: 'lyric_e2e',
    fallback: true,
    cached: false,
    provenance: 'bundled',
    document: {
      schema_version: 1,
      target_locale: locale,
      meaning_language: meaning,
      catalog_version: 1,
      phrase_ids: ids,
      title: { target: 'Café', translation: 'Cafe' },
      sections: [
        {
          name: 'Verse 1',
          lines: ids.map((id, index) => `${id} line ${index + 1}`),
        },
      ],
      used_phrases: ids.map((id, index) => ({
        catalog_phrase_id: id,
        target_text: `${id} line ${index + 1}`,
        section_name: 'Verse 1',
        line_index: index,
        match: 'exact_line',
      })),
      gloss_lines: ids.map((id, index) => ({
        target: `${id} line ${index + 1}`,
        translation: `Meaning ${index + 1}`,
      })),
    },
  }
}

function stubMusicRenders(body: unknown): Record<string, unknown> {
  const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const lyricId =
    typeof record['lyric_document_id'] === 'string' ? record['lyric_document_id'] : 'lyric_e2e'
  const styles = Array.isArray(record['style_ids'])
    ? record['style_ids'].filter((id): id is string => typeof id === 'string')
    : ['acoustic_folk', 'modern_pop', 'gentle_ballad']
  return {
    lyric_document_id: lyricId,
    jobs: styles.map((styleId) => ({
      job_id: `job_${styleId}`,
      style_id: styleId,
      status: 'ready',
      error_code: null,
      track_id: `track_${styleId}`,
      duration_ms: FIXTURE_WAV_DURATION_MS,
    })),
  }
}

function styleFromTrackId(trackId: string): string {
  return trackId.startsWith('track_') ? trackId.slice('track_'.length) : 'acoustic_folk'
}
