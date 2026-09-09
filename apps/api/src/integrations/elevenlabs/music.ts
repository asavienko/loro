/**
 * ElevenLabs Music adapter. Default CI uses fixtures / stub — no live spend.
 * `MUSIC_PROVIDER=elevenlabs` stays off until Q-21.
 */
import { createHash } from 'node:crypto'
import {
  MUSIC_MODEL_ID,
  lyricDocumentToCompositionPlan,
  type LyricDocument,
  type MusicStylePack,
  type MusicV2CompositionPlan,
} from '@loro/core'
import { ProviderConcurrency } from '../provider-concurrency.js'
import { MUSIC_FIXTURE_WAV, MUSIC_HTTP_FIXTURES, type MusicFixtureName } from './music.fixtures.js'
import { FIXTURE_WAV_DURATION_MS } from './wav.js'

export const MUSIC_CONCURRENCY = 2

export interface MusicComposeResult {
  readonly bytes: Uint8Array
  readonly contentType: 'audio/mpeg' | 'audio/wav'
  readonly durationMs: number
  readonly sha256: string
  readonly plan: MusicV2CompositionPlan
  readonly planHash: string
  readonly cached: boolean
}

export interface MusicComposeFailure {
  readonly kind:
    'bad_prompt' | 'bad_composition_plan' | 'rate_limited' | 'invalid_audio' | 'unavailable'
}

export type MusicComposeOutcome =
  | { readonly ok: true; readonly result: MusicComposeResult }
  | { readonly ok: false; readonly failure: MusicComposeFailure }

export interface MusicAdapter {
  compose(document: LyricDocument, pack: MusicStylePack): Promise<MusicComposeOutcome>
}

export class ElevenLabsMusicAdapter implements MusicAdapter {
  private readonly cache = new Map<string, MusicComposeResult>()

  constructor(
    private readonly options: {
      provider?: string
      fixture?: MusicFixtureName
      fetchImpl?: typeof fetch
      baseUrl?: string
      apiKey?: string
    } = {},
  ) {}

  compose(document: LyricDocument, pack: MusicStylePack): Promise<MusicComposeOutcome> {
    const plan = lyricDocumentToCompositionPlan(document, pack)
    const planHash = sha256Json(plan)
    const cacheKey = sha256Json({
      lyric: document,
      style_id: pack.style_id,
      pack_version: pack.pack_version,
      model_id: MUSIC_MODEL_ID,
      plan_hash: planHash,
      output_format: 'wav_fixture',
    })
    const cached = this.cache.get(cacheKey)
    if (cached) return Promise.resolve({ ok: true, result: { ...cached, cached: true } })

    const provider = this.options.provider ?? process.env['MUSIC_PROVIDER'] ?? 'stub'
    if (provider !== 'elevenlabs') {
      const result = fixtureResult(plan, planHash, this.options.fixture ?? 'compose')
      if (result.ok) this.cache.set(cacheKey, result.result)
      return Promise.resolve(result)
    }

    const fixture = this.options.fixture
    if (fixture !== undefined) {
      const result = fixtureResult(plan, planHash, fixture)
      if (result.ok) this.cache.set(cacheKey, result.result)
      return Promise.resolve(result)
    }

    const apiKey = this.options.apiKey ?? process.env['MUSIC_API_KEY']
    if (!apiKey) {
      return Promise.resolve({ ok: false, failure: { kind: 'unavailable' } })
    }
    // Live HTTP is intentionally unimplemented until Q-21. A configured key without
    // an explicit paid-smoke fixture must not spend.
    return Promise.resolve({ ok: false, failure: { kind: 'unavailable' } })
  }
}

export async function composeStyles(
  adapter: MusicAdapter,
  document: LyricDocument,
  packs: readonly MusicStylePack[],
  concurrency = MUSIC_CONCURRENCY,
): Promise<readonly MusicComposeOutcome[]> {
  const limit = Math.min(concurrency, packs.length)
  const outcomes: MusicComposeOutcome[] = []
  let next = 0
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (next < packs.length) {
      const index = next
      next += 1
      const pack = packs[index]
      if (pack === undefined) break
      outcomes[index] = await adapter.compose(document, pack)
    }
  })
  await Promise.all(workers)
  return outcomes
}

export function musicConcurrencyPool(): ProviderConcurrency {
  return new ProviderConcurrency(MUSIC_CONCURRENCY)
}

function fixtureResult(
  plan: MusicV2CompositionPlan,
  planHash: string,
  name: MusicFixtureName,
): MusicComposeOutcome {
  const fixture = MUSIC_HTTP_FIXTURES[name]
  if (name === 'bad_prompt' || name === 'bad_composition_plan') {
    return { ok: false, failure: { kind: name } }
  }
  if (name === 'rate_limited') return { ok: false, failure: { kind: 'rate_limited' } }
  if (
    name === 'truncated' ||
    (fixture.body instanceof Uint8Array && fixture.body.byteLength < 32)
  ) {
    return { ok: false, failure: { kind: 'invalid_audio' } }
  }
  const bytes = fixture.body instanceof Uint8Array ? fixture.body : MUSIC_FIXTURE_WAV
  return {
    ok: true,
    result: {
      bytes,
      contentType: 'audio/wav',
      durationMs: FIXTURE_WAV_DURATION_MS,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      plan,
      planHash,
      cached: false,
    },
  }
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
