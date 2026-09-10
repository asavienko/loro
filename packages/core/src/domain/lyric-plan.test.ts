import { describe, expect, it } from 'vitest'
import {
  MUSIC_MAX_TOTAL_MS,
  MUSIC_MIN_TOTAL_MS,
  compositionPlanHasConditioning,
  compositionPlanLeaksReviewTitle,
  lyricDocumentToCompositionPlan,
  planSectionDurations,
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
