/**
 * Phrases spoken by the server's voices (plan 106): the clip the player plays for a phrase, in each
 * language with a pinned voice (`TTS_VOICE_*`), rendered by the configured TTS provider the first
 * time it is asked for and kept, content-addressed, with the songs' audio.
 *
 * Only text the library holds can be spoken: every phrase registers its utterances (language +
 * text) when it is stored, and the route renders nothing else. An utterance's id is a hash of its
 * language and text, so its URL reveals nothing and needs no bearer (an audio element can't send
 * one). New renders per day are capped (`LIMIT_SPEECH_RENDERS_DAILY`) to bound spend. Without a
 * provider, phrases carry no clip and the app's device voice speaks them, as before.
 */
import { createHash } from 'node:crypto'
import { Controller, Get, Inject, Injectable, Logger, Optional, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { normalizeListeningText } from '@loro/core'
import { audioDurationMs } from '@loro/content/audio-duration'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import {
  TTS_RUNTIME_CONFIG,
  TTS_TRANSPORT,
  readTtsRuntimeConfig,
  type TtsRuntimeConfig,
  type TtsTransport,
} from '../tts/transport.js'

/** An utterance: a language and the text said in it. */
export function utteranceId(lang: string, text: string): string {
  return createHash('sha256')
    .update(`${lang}\n${normalizeListeningText(text)}`)
    .digest('hex')
    .slice(0, 32)
}

/** The voice that speaks a language here, or null when this server has none for it. */
export function speechVoice(
  runtime: TtsRuntimeConfig,
  lang: string,
): { voiceId: string; model: string } | null {
  if (runtime?.provider !== 'elevenlabs') return null
  const voiceId = runtime.voices[lang]?.trim()
  return voiceId ? { voiceId, model: runtime.model } : null
}

/** A phrase's clips by language, for each language this server can speak. */
export function speechFor(
  runtime: TtsRuntimeConfig,
  texts: Partial<Record<string, string>>,
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const [lang, text] of Object.entries(texts)) {
    const voice = text ? speechVoice(runtime, lang) : null
    // The voice is in the URL, so a new voice is a new clip rather than a stale cached one.
    if (voice && text)
      out[lang] =
        `/library/speech/${utteranceId(lang, text)}.mp3?v=${createHash('sha256').update(`${voice.voiceId}:${voice.model}`).digest('hex').slice(0, 8)}`
  }
  return out
}

/** Records the utterances a stored phrase may be spoken in. */
export async function registerSpeech(
  tx: SqlConnection,
  texts: Partial<Record<string, string>>,
  now: number,
): Promise<void> {
  for (const [lang, text] of Object.entries(texts)) {
    if (!text) continue
    await tx.query(
      `INSERT INTO library_speech(id, lang, text, voice_id, model, audio_id, duration_ms, created_at)
       VALUES ($1,$2,$3,NULL,NULL,NULL,NULL,$4) ON CONFLICT (id) DO NOTHING`,
      [utteranceId(lang, text), lang, normalizeListeningText(text), now],
    )
  }
}

const DEFAULT_DAILY_RENDERS = 500
/** A clip whose render failed (a voice the provider refuses) isn't asked for again for this long. */
const RETRY_AFTER_FAILURE_MS = 6 * 3_600_000

interface SpeechRow {
  id: string
  lang: string
  text: string
  voice_id: string | null
  model: string | null
  audio_id: string | null
  failed_at: string | number | null
}

@Injectable()
export class SpeechService {
  private readonly logger = new Logger('speech')
  private readonly inflight = new Map<string, Promise<{ bytes: Buffer; contentType: string }>>()

  constructor(
    @Inject(DATABASE) private readonly db: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(TTS_TRANSPORT) private readonly transport: TtsTransport,
    @Optional() @Inject(TTS_RUNTIME_CONFIG) private readonly runtime?: TtsRuntimeConfig,
  ) {}

  config(): TtsRuntimeConfig {
    return this.runtime !== undefined ? this.runtime : readTtsRuntimeConfig()
  }

  /** The clip for an utterance the library holds, rendered on first request. */
  async clip(file: string): Promise<{ bytes: Buffer; contentType: string }> {
    const id = /^([a-f0-9]{32})\.mp3$/.exec(file)?.[1]
    if (!id) throw new LoroError('NOT_FOUND')
    const row = (await this.db.query<SpeechRow>('SELECT * FROM library_speech WHERE id = $1', [id]))
      .rows[0]
    if (!row) throw new LoroError('NOT_FOUND')
    const voice = speechVoice(this.config(), row.lang)
    if (!voice) throw new LoroError('PROVIDER_UNAVAILABLE')
    if (row.audio_id && row.voice_id === voice.voiceId && row.model === voice.model) {
      const stored = (
        await this.db.query<{ body: Buffer; content_type: string }>(
          'SELECT body, content_type FROM library_audio WHERE id = $1',
          [row.audio_id],
        )
      ).rows[0]
      if (stored) return { bytes: stored.body, contentType: stored.content_type }
    }
    // A render that just failed would fail again and cost a try: the device voice speaks meanwhile.
    if (
      row.failed_at !== null &&
      this.clock.now() - Number(row.failed_at) < RETRY_AFTER_FAILURE_MS
    ) {
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    const pending = this.inflight.get(id)
    if (pending) return pending
    const work = this.render(row, voice)
    this.inflight.set(id, work)
    try {
      return await work
    } finally {
      this.inflight.delete(id)
    }
  }

  private async render(
    row: SpeechRow,
    voice: { voiceId: string; model: string },
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const day = new Date(this.clock.now()).toISOString().slice(0, 10)
    const limit = Number(process.env['LIMIT_SPEECH_RENDERS_DAILY'] ?? DEFAULT_DAILY_RENDERS)
    const counted = await this.db.query<{ used: number }>(
      `INSERT INTO library_usage(user_id, kind, day, used) VALUES ('__server__', 'speech', $1, 1)
       ON CONFLICT (user_id, kind, day) DO UPDATE SET used = library_usage.used + 1 WHERE library_usage.used < $2
       RETURNING used`,
      [day, limit],
    )
    if (counted.rows.length === 0)
      throw new LoroError('PROVIDER_UNAVAILABLE', 'Speech renders are used up for today')
    let result
    try {
      result = await this.transport.synthesize({
        text: row.text,
        locale: row.lang,
        voiceId: voice.voiceId,
        modelId: voice.model,
      })
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
      this.logger.warn(`speech render failed (${row.lang}): ${code}`)
      // A failure doesn't use up the day's renders, and isn't retried for a while.
      await this.db.query(
        `UPDATE library_usage SET used = used - 1 WHERE user_id = '__server__' AND kind = 'speech' AND day = $1 AND used > 0`,
        [day],
      )
      await this.db.query('UPDATE library_speech SET failed_at = $2 WHERE id = $1', [
        row.id,
        this.clock.now(),
      ])
      throw new LoroError('PROVIDER_UNAVAILABLE')
    }
    if (result.provenance.provider !== 'elevenlabs') throw new LoroError('PROVIDER_UNAVAILABLE')
    const bytes = Buffer.from(result.bytes)
    const audioId = createHash('sha256').update(bytes).digest('hex')
    await this.db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO library_audio(id, content_type, byte_length, body) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
        [audioId, result.contentType, bytes.byteLength, bytes],
      )
      await tx.query(
        'UPDATE library_speech SET voice_id = $2, model = $3, audio_id = $4, duration_ms = $5, failed_at = NULL WHERE id = $1',
        [row.id, voice.voiceId, voice.model, audioId, audioDurationMs(bytes)],
      )
    })
    return { bytes, contentType: result.contentType }
  }
}

@Controller('library/speech')
export class SpeechController {
  constructor(@Inject(SpeechService) private readonly speech: SpeechService) {}

  @Get(':file')
  async clip(@Param('file') file: string, @Res() response: Response): Promise<void> {
    const { bytes, contentType } = await this.speech.clip(file)
    response.setHeader('Content-Type', contentType)
    response.setHeader('Content-Length', String(bytes.byteLength))
    // The voice is in the URL: a clip at one URL never changes.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.end(bytes)
  }
}
