/**
 * Composition-plan geometry for phrase songs. Durations are planned here so lyrics
 * and ElevenLabs chunks share one 35–60 s budget (plan 96).
 */
export interface MusicV2Chunk {
  readonly text: string
  readonly duration_ms: number
  readonly positive_styles: string[]
  readonly negative_styles: string[]
}

export interface MusicV2CompositionPlan {
  readonly chunks: MusicV2Chunk[]
  readonly context_adherence: 'high'
}

export interface MusicLyricPlanInput {
  readonly title: { readonly target: string; readonly translation: string }
  readonly sections: readonly { readonly name: string; readonly lines: readonly string[] }[]
}

export const MUSIC_MIN_PHRASES = 3
export const MUSIC_MAX_PHRASES = 8
export const MUSIC_MIN_STYLES = 2
export const MUSIC_MAX_STYLES = 4

/** The styles a song can be sung in (plan 113): each has a style pack and a demo setting. */
export const MUSIC_STYLE_IDS = [
  'acoustic_folk',
  'modern_pop',
  'gentle_ballad',
  'upbeat_kids',
  'indie_rock',
  'hip_hop',
  'reggaeton',
  'jazz_lounge',
  'electronic_dance',
  'country',
  'lullaby',
  'bossa_nova',
] as const
export type MusicStyleId = (typeof MUSIC_STYLE_IDS)[number]

/**
 * How a song is sung besides its style (plan 113): who sings it, how fast, in what mood, and how
 * long it runs. `any` and a null mood leave it to the style.
 */
export const SONG_VOICES = ['any', 'female', 'male', 'duet'] as const
export type SongVoice = (typeof SONG_VOICES)[number]
export const SONG_TEMPOS = ['slow', 'natural', 'lively'] as const
export type SongTempo = (typeof SONG_TEMPOS)[number]
export const SONG_MOODS = [
  'cheerful',
  'calm',
  'romantic',
  'nostalgic',
  'energetic',
  'playful',
] as const
export type SongMood = (typeof SONG_MOODS)[number]
export const SONG_LENGTHS = ['short', 'standard', 'long'] as const
export type SongLength = (typeof SONG_LENGTHS)[number]

/** A song's options, every one resolved. `theme` is what the learner wants it to be about. */
export interface SongOptions {
  voice: SongVoice
  tempo: SongTempo
  mood: SongMood | null
  length: SongLength
  theme: string | null
}

export const DEFAULT_SONG_OPTIONS: SongOptions = {
  voice: 'any',
  tempo: 'natural',
  mood: null,
  length: 'standard',
  theme: null,
}

/**
 * What each length allows: the most lines its lyrics may have, and the bounds of the music asked
 * for. `long` is the sixteen lines and two minutes every song had before.
 */
export const SONG_LENGTH_LIMITS: Record<
  SongLength,
  { lines: number; minMs: number; maxMs: number }
> = {
  short: { lines: 8, minMs: 30_000, maxMs: 50_000 },
  standard: { lines: 12, minMs: 40_000, maxMs: 80_000 },
  long: { lines: 16, minMs: 60_000, maxMs: 120_000 },
}

/** Seconds of music per lyric line at each tempo: a slower song gives every line more room. */
export const SONG_TEMPO_LINE_MS: Record<SongTempo, number> = {
  slow: 6_000,
  natural: 5_000,
  lively: 4_000,
}

/** The music asked for: the lines at the tempo's pace, kept within the length's bounds. */
export function songLengthMs(
  options: Pick<SongOptions, 'tempo' | 'length'>,
  lineCount: number,
): number {
  const limits = SONG_LENGTH_LIMITS[options.length]
  return Math.min(
    limits.maxMs,
    Math.max(limits.minMs, lineCount * SONG_TEMPO_LINE_MS[options.tempo]),
  )
}

export const MUSIC_MIN_TOTAL_MS = 35_000
export const MUSIC_MAX_TOTAL_MS = 60_000
export const MUSIC_MIN_CHUNK_MS = 8_000
export const MUSIC_MAX_CHUNK_MS = 15_000
export const MUSIC_TARGET_TOTAL_MS = 45_000
export const MUSIC_MIN_SECTIONS_FOR_DURATION = 3
export const MUSIC_MODEL_ID = 'music_v2' as const
export const MUSIC_VOCAL_CUES = ['{soft vocal}'] as const
export type MusicVocalCue = (typeof MUSIC_VOCAL_CUES)[number]

export interface MusicStylePack {
  readonly style_id: MusicStyleId
  readonly pack_version: number
  readonly positive_styles: readonly string[]
  readonly negative_styles: readonly string[]
  readonly vocal_cue?: MusicVocalCue
}

export function isMusicStyleId(value: string): value is MusicStyleId {
  return (MUSIC_STYLE_IDS as readonly string[]).includes(value)
}

/** Even chunks so 3–8 phrases fit 35–60 s without one verse per phrase. */
export function planSectionDurations(sectionCount: number): number[] {
  if (
    !Number.isSafeInteger(sectionCount) ||
    sectionCount < MUSIC_MIN_SECTIONS_FOR_DURATION ||
    sectionCount > 7
  ) {
    return []
  }
  const raw = Math.round(MUSIC_TARGET_TOTAL_MS / sectionCount)
  const per = Math.min(MUSIC_MAX_CHUNK_MS, Math.max(MUSIC_MIN_CHUNK_MS, raw))
  const durations = Array.from({ length: sectionCount }, () => per)
  let total = durations.reduce((sum, value) => sum + value, 0)
  if (total < MUSIC_MIN_TOTAL_MS) {
    const extra = MUSIC_MIN_TOTAL_MS - total
    durations[durations.length - 1] = Math.min(
      MUSIC_MAX_CHUNK_MS,
      (durations[durations.length - 1] ?? per) + extra,
    )
    total = durations.reduce((sum, value) => sum + value, 0)
  }
  if (total > MUSIC_MAX_TOTAL_MS) {
    const overflow = total - MUSIC_MAX_TOTAL_MS
    durations[durations.length - 1] = Math.max(
      MUSIC_MIN_CHUNK_MS,
      (durations[durations.length - 1] ?? per) - overflow,
    )
    total = durations.reduce((sum, value) => sum + value, 0)
  }
  if (total < MUSIC_MIN_TOTAL_MS || total > MUSIC_MAX_TOTAL_MS) return []
  if (durations.some((value) => value < MUSIC_MIN_CHUNK_MS || value > MUSIC_MAX_CHUNK_MS)) {
    return []
  }
  return durations
}

export function plannedTotalDurationMs(sectionCount: number): number | null {
  const durations = planSectionDurations(sectionCount)
  if (durations.length === 0) return null
  return durations.reduce((sum, value) => sum + value, 0)
}

export function lyricDocumentToCompositionPlan(
  document: MusicLyricPlanInput,
  pack: MusicStylePack,
): MusicV2CompositionPlan {
  const durations = planSectionDurations(document.sections.length)
  if (durations.length !== document.sections.length) {
    throw new Error('Lyric document cannot be packed into the 35–60 s music budget')
  }
  const cue =
    pack.vocal_cue !== undefined && MUSIC_VOCAL_CUES.includes(pack.vocal_cue)
      ? `${pack.vocal_cue}\n`
      : ''
  return {
    context_adherence: 'high',
    chunks: document.sections.map((section, index) => ({
      text: `${cue}[${section.name}]\n${section.lines.join('\n')}`,
      duration_ms: durations[index] ?? MUSIC_MIN_CHUNK_MS,
      positive_styles: [...pack.positive_styles],
      negative_styles: [...pack.negative_styles],
    })),
  }
}

/** True when a review-only title that is not a sung line leaked onto the vendor wire. */
export function compositionPlanLeaksReviewTitle(
  plan: MusicV2CompositionPlan,
  document: MusicLyricPlanInput,
): boolean {
  const sung = new Set(document.sections.flatMap((section) => section.lines))
  const haystack = plan.chunks.map((chunk) => chunk.text).join('\n')
  return [document.title.target, document.title.translation].some(
    (title) => !sung.has(title) && haystack.includes(title),
  )
}

export function compositionPlanHasConditioning(plan: unknown): boolean {
  if (typeof plan !== 'object' || plan === null) return false
  return 'conditioning_ref' in plan || 'AudioRefChunk' in plan || 'sections' in plan
}

/**
 * A song's options with what was left out filled from `base` (the approved lyrics' options, or the
 * defaults). An empty theme is no theme.
 */
export function resolveSongOptions(
  given: { [K in keyof SongOptions]?: SongOptions[K] | null | undefined } | null | undefined,
  base: SongOptions = DEFAULT_SONG_OPTIONS,
): SongOptions {
  const asked = given?.theme?.trim() ?? ''
  const theme = given?.theme === undefined ? base.theme : asked.length > 0 ? asked : null
  return {
    voice: given?.voice ?? base.voice,
    tempo: given?.tempo ?? base.tempo,
    mood: given?.mood === undefined ? base.mood : given.mood,
    length: given?.length ?? base.length,
    theme,
  }
}

/** Options read back from storage: anything unknown is the default, as rows from before them are. */
export function storedSongOptions(value: unknown): SongOptions {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined
  return {
    voice: pick(SONG_VOICES, row.voice) ?? DEFAULT_SONG_OPTIONS.voice,
    tempo: pick(SONG_TEMPOS, row.tempo) ?? DEFAULT_SONG_OPTIONS.tempo,
    mood: pick(SONG_MOODS, row.mood) ?? null,
    length: pick(SONG_LENGTHS, row.length) ?? DEFAULT_SONG_OPTIONS.length,
    theme: typeof row.theme === 'string' && row.theme.trim() ? row.theme.trim() : null,
  }
}
