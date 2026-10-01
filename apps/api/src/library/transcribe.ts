/**
 * A sung song heard back (plan 113): ElevenLabs Scribe transcribes the server's own song with a
 * timestamp per word, so the lyrics can be shown as they were sung and lit as they play. Only the
 * song the server made is ever sent: no learner audio exists in this process
 * ([ADR-0017](../../../../docs/architecture/adr/0017-transcribing-generated-songs.md)). One
 * attempt, a deadline, a bounded reply; the key and the provider's body are never logged.
 */
import { boundedJson, isRecord } from '../integrations/bounded-body.js'
import { ProviderFailure } from '../integrations/provider-failure.js'
import { config } from '../common/config.js'
import type { HeardWord } from './align.js'
import { liveMusicConfigured } from './music-live.js'

export const SCRIBE_MODEL = 'scribe_v1'
const MAX_REPLY_BYTES = 2_000_000
const TIMEOUT_MS = 120_000

/** Whether sung songs are heard back here: the music key is set, and it isn't turned off. */
export function transcriptionConfigured(): boolean {
  return liveMusicConfigured() && config.musicTranscribe()
}

/** Scribe takes a language code without a region: `es`, `bg`, `en`. */
export function scribeLanguage(lang: string): string {
  return lang.split('-')[0]?.toLowerCase() ?? lang
}

/**
 * The words Scribe heard, in order, each with when it was sung. Throws a `ProviderFailure`; the
 * caller keeps the lyrics untimed when it does.
 */
export async function transcribeSong(input: {
  bytes: Uint8Array
  contentType: string
  targetLang: string
  send?: typeof fetch
}): Promise<HeardWord[]> {
  const apiKey = config.musicApiKey()?.trim()
  if (!apiKey) throw new ProviderFailure('configuration')
  const form = new FormData()
  form.set('model_id', SCRIBE_MODEL)
  form.set('language_code', scribeLanguage(input.targetLang))
  form.set('timestamps_granularity', 'word')
  form.set('diarize', 'false')
  form.set('tag_audio_events', 'false')
  form.set('file', new Blob([input.bytes], { type: input.contentType }), 'song')
  const deadline = AbortSignal.timeout(TIMEOUT_MS)
  try {
    const response = await (input.send ?? fetch)(`${config.musicBaseUrl()}/v1/speech-to-text`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: deadline,
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new ProviderFailure(response.status === 429 ? 'rate_limited' : 'unavailable')
    }
    return readScribe(
      await boundedJson(response, MAX_REPLY_BYTES, () => new ProviderFailure('invalid_output')),
    )
  } catch (error) {
    if (deadline.aborted) throw new ProviderFailure('timeout')
    if (error instanceof ProviderFailure) throw error
    throw new ProviderFailure('unavailable')
  }
}

/** Scribe's reply as heard words: only its `word` entries, with sane times in order. */
export function readScribe(reply: unknown): HeardWord[] {
  if (!isRecord(reply) || !Array.isArray(reply['words']))
    throw new ProviderFailure('invalid_output')
  const words: HeardWord[] = []
  let last = 0
  for (const entry of reply['words']) {
    if (!isRecord(entry)) throw new ProviderFailure('invalid_output')
    if (entry['type'] !== undefined && entry['type'] !== 'word') continue
    const text = entry['text']
    const start = entry['start']
    const end = entry['end']
    if (
      typeof text !== 'string' ||
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start
    )
      throw new ProviderFailure('invalid_output')
    const startMs = Math.round(start * 1000)
    const endMs = Math.round(end * 1000)
    if (startMs < last) throw new ProviderFailure('invalid_output')
    last = startMs
    if (text.trim()) words.push({ text: text.trim(), startMs, endMs })
  }
  return words
}
