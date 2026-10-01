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
