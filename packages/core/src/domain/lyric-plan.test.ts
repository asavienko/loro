import { describe, expect, it } from 'vitest'
import {
  MUSIC_MAX_TOTAL_MS,
  MUSIC_MIN_TOTAL_MS,
  compositionPlanHasConditioning,
  compositionPlanLeaksReviewTitle,
  lyricDocumentToCompositionPlan,
  planSectionDurations,
  DEFAULT_SONG_OPTIONS,
  resolveSongOptions,
  SONG_LENGTH_LIMITS,
  songLengthMs,
  storedSongOptions,
} from './lyric-plan.js'
import { bundledLyricDocument } from './lyrics.js'

describe('music duration packing', () => {
  it('packs 3–7 sections into 35–60 s and rejects two- or eight-section plans', () => {
    expect(planSectionDurations(2)).toEqual([])
    expect(planSectionDurations(8)).toEqual([])
    for (const count of [3, 4, 5, 6, 7]) {
      const durations = planSectionDurations(count)
      const total = durations.reduce((sum, value) => sum + value, 0)
      expect(durations).toHaveLength(count)
      expect(total).toBeGreaterThanOrEqual(MUSIC_MIN_TOTAL_MS)
      expect(total).toBeLessThanOrEqual(MUSIC_MAX_TOTAL_MS)
    }
  })

  it('builds music_v2 chunks without title, sections, or conditioning_ref', () => {
    const document = {
      ...bundledLyricDocument(
        [
          {
            id: 'cafe1',
            targetText: 'Me pone un cortado, por favor',
            translation: 'A cortado, please',
          },
          {
            id: 'cafe2',
            targetText: '¿Tienen leche de avena?',
            translation: 'Do you have oat milk?',
          },
          { id: 'cafe3', targetText: 'Para llevar, por favor', translation: 'To go, please' },
        ],
        'es-ES',
        'en',
        1,
      ),
      title: { target: 'Review Only Title', translation: 'Not For ElevenLabs' },
    }
    const plan = lyricDocumentToCompositionPlan(document, {
      style_id: 'gentle_ballad',
      pack_version: 1,
      positive_styles: [
        'gentle ballad',
        'piano',
        'soft vocal',
        'slow tempo',
        'warm',
        'great production quality',
      ],
      negative_styles: ['rap verse'],
      vocal_cue: '{soft vocal}',
    })
    expect(plan.chunks[0]?.text.startsWith('{soft vocal}\n[Verse 1]')).toBe(true)
    expect(compositionPlanLeaksReviewTitle(plan, document)).toBe(false)
    expect(compositionPlanHasConditioning(plan)).toBe(false)
    expect(compositionPlanHasConditioning({ ...plan, conditioning_ref: 'song_1' })).toBe(true)
  })
})

describe('song options (plan 113)', () => {
  it('fills what was left out from the base, and reads unknown stored values as the defaults', () => {
    expect(resolveSongOptions(undefined)).toEqual(DEFAULT_SONG_OPTIONS)
    const base = resolveSongOptions({ voice: 'male', mood: 'calm', theme: ' rain ' })
    expect(base).toEqual({ ...DEFAULT_SONG_OPTIONS, voice: 'male', mood: 'calm', theme: 'rain' })
    // A request may clear the mood or theme its lyrics were written with.
    expect(resolveSongOptions({ mood: null, theme: '' }, base)).toEqual({
      ...base,
      mood: null,
      theme: null,
    })
    expect(resolveSongOptions({ tempo: 'lively' }, base)).toEqual({ ...base, tempo: 'lively' })
    expect(storedSongOptions(null)).toEqual(DEFAULT_SONG_OPTIONS)
    expect(storedSongOptions({ voice: 'robot', length: 'short' })).toEqual({
      ...DEFAULT_SONG_OPTIONS,
      length: 'short',
    })
  })

  it('asks for the lines at the tempo’s pace, within the length’s bounds', () => {
    expect(songLengthMs({ tempo: 'natural', length: 'standard' }, 12)).toBe(60_000)
    expect(songLengthMs({ tempo: 'slow', length: 'short' }, 10)).toBe(
      SONG_LENGTH_LIMITS.short.maxMs,
    )
    expect(songLengthMs({ tempo: 'lively', length: 'long' }, 4)).toBe(SONG_LENGTH_LIMITS.long.minMs)
  })
})
