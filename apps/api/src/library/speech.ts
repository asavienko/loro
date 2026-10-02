/**
 * Phrases spoken by the server's voices (plan 106): the clip the player plays for a phrase, in each
 * language with a pinned voice (`TTS_VOICE_*`), rendered by the configured TTS provider the first
 * time it is asked for and kept, content-addressed, with the songs' audio.
 *
 * Only text the library holds can be spoken: every phrase registers its utterances (language +
 * text) when it is stored, and the route renders nothing else. An utterance's id is a hash of its
 * language and text, so its URL reveals nothing and needs no bearer (an audio element can't send
 * one). New renders per day are capped (`LIMIT_SPEECH_RENDERS_DAILY`) to bound spend. Without a
 * provider, phrases carry no clip and the app says it can't play them.
 *
 * A clip not rendered yet is made on demand (P3-01): `<id>.json` says where it stands (`ready`,
 * `rendering`, `failed`) and, asked about one that isn't made, starts its render in the background,
 * so the app can show that the recording is being made and play it when it is ready rather than
 * wait on a request that is still rendering. Asking for the `.mp3` itself renders it too.
 */
import { createHash } from 'node:crypto'
import {
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  Optional,
  Param,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { normalizeListeningText } from '@loro/core'
import { audioDurationMs } from '@loro/content/audio-duration'
import { V2_LANGUAGES } from '@loro/content/v2'
import { DEMO_SAMPLE_RATE } from './synth.js'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import { ElevenLabsTts } from '../integrations/elevenlabs/tts.js'
import {
  TTS_RUNTIME_CONFIG,
  TTS_TRANSPORT,
  readTtsRuntimeConfig,
  type TtsRuntimeConfig,
  type TtsTransport,
} from '../tts/transport.js'

/** Nest token for a raw-PCM voice, for tests; production builds one from the TTS config. */
export const PCM_TRANSPORT = Symbol('PcmTransport')

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

/**
 * The languages Loro offers that this server's provider has no voice for. Their phrases and prompts
 * carry no clip, so the app can only say there is no recording (Q-15); without a provider, none.
 */
export function silentLanguages(runtime: TtsRuntimeConfig): string[] {
  if (runtime?.provider !== 'elevenlabs') return []
  return V2_LANGUAGES.map((l) => l.code).filter((code) => speechVoice(runtime, code) === null)
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

/**
 * Records the utterances a stored phrase may be spoken in; `ownerId` is the learner whose phrase it
 * is (null for Loro's), whose own allowance its first render counts against.
 */
export async function registerSpeech(
  tx: SqlConnection,
  texts: Partial<Record<string, string>>,
  now: number,
  ownerId: string | null = null,
): Promise<void> {
  await registerSpeechMany(tx, [texts], now, ownerId)
}

/** registerSpeech for many phrases in one statement: a seed registers the whole bank. */
export async function registerSpeechMany(
  tx: SqlConnection,
  phrases: readonly Partial<Record<string, string>>[],
  now: number,
  ownerId: string | null = null,
): Promise<void> {
  const rows = new Map<string, [string, string]>()
  for (const texts of phrases)
    for (const [lang, text] of Object.entries(texts))
      if (text) rows.set(utteranceId(lang, text), [lang, normalizeListeningText(text)])
  if (rows.size === 0) return
  const entries = [...rows]
  await tx.query(
    `INSERT INTO library_speech(id, lang, text, voice_id, model, audio_id, duration_ms, created_at, owner_id)
     SELECT id, lang, text, NULL, NULL, NULL, NULL, $4, $5
     FROM unnest($1::text[], $2::text[], $3::text[]) AS u(id, lang, text)
     ON CONFLICT (id) DO NOTHING`,
    [
      entries.map(([id]) => id),
      entries.map(([, [lang]]) => lang),
      entries.map(([, [, text]]) => text),
      now,
      ownerId,
    ],
  )
}

const DEFAULT_DAILY_RENDERS = 500
/** Failures that say nothing about the clip itself. */
const TRANSIENT = new Set(['capacity', 'rate_limited', 'timeout', 'cancelled'])
const BUSY_ATTEMPTS = 3
const BUSY_WAIT_MS = 700

function failureCode(error: unknown): string {
  return error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
}
/** New clips one learner's phrases may have rendered a day. */
const DEFAULT_OWNER_RENDERS = 100
/** A clip whose render failed (a voice the provider refuses) isn't asked for again for this long. */
const RETRY_AFTER_FAILURE_MS = 6 * 3_600_000
/**
 * A render that failed for a passing reason (a busy provider, the day's renders used up) answers as
 * failed for this long, so an app asking where it stands hears so rather than starting it again.
 */
const PASSING_FAILURE_MS = 30_000

/** Where a phrase's clip stands, as `GET /library/speech/<id>.json` answers. */
export interface ClipState {
  status: 'ready' | 'rendering' | 'failed'
}

interface SpeechRow {
  id: string
  lang: string
  text: string
  voice_id: string | null
  model: string | null
  audio_id: string | null
  failed_at: string | number | null
  owner_id: string | null
}

@Injectable()
export class SpeechService implements OnModuleInit {
  private readonly logger = new Logger('speech')
  private readonly inflight = new Map<string, Promise<{ bytes: Buffer; contentType: string }>>()
  /** Utterances whose last render failed for a passing reason, and when. */
  private readonly lately = new Map<string, number>()

  constructor(
    @Inject(DATABASE) private readonly db: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(TTS_TRANSPORT) private readonly transport: TtsTransport,
    @Optional() @Inject(TTS_RUNTIME_CONFIG) private readonly runtime?: TtsRuntimeConfig,
    /** Renders raw PCM for song lines; built from the runtime config unless a test supplies one. */
    @Optional() @Inject(PCM_TRANSPORT) private readonly pcmTransport?: TtsTransport,
  ) {}

  /** A language left without a voice is silent in the app; said once, where a deploy shows it. */
  onModuleInit(): void {
    const silent = silentLanguages(this.config())
    if (silent.length > 0)
      this.logger.warn(
        `no voice for ${silent.join(', ')}: their phrases have no clips (set TTS_VOICE_*)`,
      )
  }

  private pcm: TtsTransport | null | undefined

  /** A voice that answers in raw PCM at the demo's rate, or null without a provider. */
  private pcmVoice(): TtsTransport | null {
    if (this.pcmTransport) return this.pcmTransport
    if (this.pcm !== undefined) return this.pcm
    const runtime = this.config()
    this.pcm =
      runtime?.provider === 'elevenlabs'
        ? new ElevenLabsTts({
            apiKey: runtime.apiKey,
            model: runtime.model,
            outputFormat: `pcm_${DEMO_SAMPLE_RATE}`,
            timeoutMs: 10_000,
            maxRequestBytes: 16_384,
            maxResponseBytes: 4_000_000,
            maxConcurrentRequests: 2,
          })
        : null
    return this.pcm
  }

  /**
   * Song lines spoken by the language's voice, as mono PCM at the demo's rate, each counted against
   * the owner's and the server's day like a phrase clip. A line that can't be spoken is null: the
   * song keeps its music there.
   */
  async songVoices(
    lang: string,
    texts: readonly string[],
    ownerId: string,
  ): Promise<(Int16Array | null)[]> {
    const voice = speechVoice(this.config(), lang)
    const transport = this.pcmVoice()
    if (!voice || !transport) return texts.map(() => null)
    const day = new Date(this.clock.now()).toISOString().slice(0, 10)
    const spoken = new Map<string, Int16Array | null>()
    const out: (Int16Array | null)[] = []
    for (const text of texts) {
      const key = normalizeListeningText(text)
      if (!spoken.has(key))
        spoken.set(key, await this.linePcm(transport, voice, lang, key, ownerId, day))
      out.push(spoken.get(key) ?? null)
    }
    return out
  }

  private async linePcm(
    transport: TtsTransport,
    voice: { voiceId: string; model: string },
    lang: string,
    text: string,
    ownerId: string,
    day: string,
  ): Promise<Int16Array | null> {
    const budgets: [string, number][] = [
      ['__server__', Number(process.env['LIMIT_SPEECH_RENDERS_DAILY'] ?? DEFAULT_DAILY_RENDERS)],
      [ownerId, Number(process.env['LIMIT_SPEECH_OWNER_DAILY'] ?? DEFAULT_OWNER_RENDERS)],
    ]
    const taken: string[] = []
    for (const [who, limit] of budgets) {
      if (!(await this.take(who, day, limit))) {
        for (const back of taken) await this.giveBack(back, day)
        return null
      }
      taken.push(who)
    }
    try {
      const result = await transport.synthesize({
        text,
        locale: lang,
        voiceId: voice.voiceId,
        modelId: voice.model,
      })
      if (result.provenance.provider !== 'elevenlabs') throw new Error('not a voice')
      const bytes = result.bytes
      return new Int16Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + (bytes.byteLength & ~1)),
      )
    } catch (error) {
      this.logger.warn(`song line voice failed (${lang}): ${failureCode(error)}`)
      for (const back of taken) await this.giveBack(back, day)
      return null
    }
  }

  config(): TtsRuntimeConfig {
    return this.runtime !== undefined ? this.runtime : readTtsRuntimeConfig()
  }

  private async row(file: string, ext: 'mp3' | 'json'): Promise<SpeechRow | undefined> {
    const id = new RegExp(`^([a-f0-9]{32})\\.${ext}$`).exec(file)?.[1]
    if (!id) throw new LoroError('NOT_FOUND')
    return (await this.db.query<SpeechRow>('SELECT * FROM library_speech WHERE id = $1', [id]))
      .rows[0]
  }

  /** Whether a render that failed lately would only fail again, so it isn't tried yet. */
  private resting(row: SpeechRow): boolean {
    const now = this.clock.now()
    if (row.failed_at !== null && now - Number(row.failed_at) < RETRY_AFTER_FAILURE_MS) return true
    const at = this.lately.get(row.id)
    return at !== undefined && now - at < PASSING_FAILURE_MS
  }

  /**
   * Where a clip stands (P3-01). One not made yet starts rendering in the background (once, however
   * many ask) and answers `rendering`; one that can't be made answers `failed`. Text the library
   * doesn't hold answers `failed` too, as the clip route does.
   */
  async clipState(file: string): Promise<ClipState> {
    const row = await this.row(file, 'json')
    const voice = row ? speechVoice(this.config(), row.lang) : null
    if (!row || !voice) return { status: 'failed' }
    if (row.audio_id && row.voice_id === voice.voiceId && row.model === voice.model)
      return { status: 'ready' }
    if (this.inflight.has(row.id)) return { status: 'rendering' }
    if (this.resting(row)) return { status: 'failed' }
    // Its failure is kept in `lately`, for the next time the app asks.
    this.ensure(row, voice).catch(() => undefined)
    return { status: 'rendering' }
  }

  /** The render of an utterance's clip: started once, shared by everyone waiting on it. */
  private ensure(
    row: SpeechRow,
    voice: { voiceId: string; model: string },
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const pending = this.inflight.get(row.id)
    if (pending) return pending
    const work = this.render(row, voice).then(
      (clip) => {
        this.lately.delete(row.id)
        return clip
      },
      (error: unknown) => {
        const now = this.clock.now()
        for (const [id, at] of this.lately)
          if (now - at >= PASSING_FAILURE_MS) this.lately.delete(id)
        this.lately.set(row.id, now)
        throw error
      },
    )
    this.inflight.set(row.id, work)
    const done = () => {
      if (this.inflight.get(row.id) === work) this.inflight.delete(row.id)
    }
    work.then(done, done)
    return work
  }

  /** The clip for an utterance the library holds, rendered on first request. */
  async clip(file: string): Promise<{ bytes: Buffer; contentType: string }> {
    const row = await this.row(file, 'mp3')
    // Text the library doesn't hold answers as a clip that can't be made, so the route can't be
    // used to learn which phrases are in someone's private set.
    if (!row) throw new LoroError('PROVIDER_UNAVAILABLE')
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
    const pending = this.inflight.get(row.id)
    if (pending) return pending
    // A render that just failed would fail again and cost a try: the app says it can't play.
    if (this.resting(row)) throw new LoroError('PROVIDER_UNAVAILABLE')
    return this.ensure(row, voice)
  }

  /** The provider allows few requests at once: a busy answer waits a moment and asks again. */
  private async synthesize(row: SpeechRow, voice: { voiceId: string; model: string }) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transport.synthesize({
          text: row.text,
          locale: row.lang,
          voiceId: voice.voiceId,
          modelId: voice.model,
        })
      } catch (error) {
        const code = failureCode(error)
        if (attempt >= BUSY_ATTEMPTS || (code !== 'capacity' && code !== 'rate_limited'))
          throw error
        await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS * attempt))
      }
    }
  }

  private async take(who: string, day: string, limit: number): Promise<boolean> {
    const counted = await this.db.query<{ used: number }>(
      `INSERT INTO library_usage(user_id, kind, day, used) VALUES ($1, 'speech', $2, 1)
       ON CONFLICT (user_id, kind, day) DO UPDATE SET used = library_usage.used + 1 WHERE library_usage.used < $3
       RETURNING used`,
      [who, day, limit],
    )
    return counted.rows.length > 0
  }

  private async giveBack(who: string, day: string): Promise<void> {
    await this.db.query(
      `UPDATE library_usage SET used = used - 1 WHERE user_id = $1 AND kind = 'speech' AND day = $2 AND used > 0`,
      [who, day],
    )
  }

  private async render(
    row: SpeechRow,
    voice: { voiceId: string; model: string },
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const day = new Date(this.clock.now()).toISOString().slice(0, 10)
    // Every render counts against the server's day, and a learner's phrase against theirs too, so
    // no one account can spend everyone's renders.
    const budgets: [string, number][] = [
      ['__server__', Number(process.env['LIMIT_SPEECH_RENDERS_DAILY'] ?? DEFAULT_DAILY_RENDERS)],
      ...(row.owner_id
        ? [
            [
              row.owner_id,
              Number(process.env['LIMIT_SPEECH_OWNER_DAILY'] ?? DEFAULT_OWNER_RENDERS),
            ] as [string, number],
          ]
        : []),
    ]
    const taken: string[] = []
    for (const [who, limit] of budgets) {
      if (!(await this.take(who, day, limit))) {
        for (const back of taken) await this.giveBack(back, day)
        throw new LoroError('PROVIDER_UNAVAILABLE', 'Speech renders are used up for today')
      }
      taken.push(who)
    }
    let result
    try {
      result = await this.synthesize(row, voice)
    } catch (error) {
      const code = failureCode(error)
      this.logger.warn(`speech render failed (${row.lang}): ${code}`)
      // A failure doesn't use up the day's renders. A lasting one (a voice or text the provider
      // refuses) isn't asked for again for a while; a busy provider is asked again next time.
      for (const back of taken) await this.giveBack(back, day)
      if (!TRANSIENT.has(code)) {
        await this.db.query('UPDATE library_speech SET failed_at = $2 WHERE id = $1', [
          row.id,
          this.clock.now(),
        ])
      }
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
    if (file.endsWith('.json')) {
      // Where a clip stands (P3-01): asked again while it renders.
      const state = await this.speech.clipState(file)
      response.setHeader('Cache-Control', 'no-store')
      response.json(state)
      return
    }
    const { bytes, contentType } = await this.speech.clip(file)
    response.setHeader('Content-Type', contentType)
    response.setHeader('Content-Length', String(bytes.byteLength))
    // The voice is in the URL: a clip at one URL never changes.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.end(bytes)
  }
}
