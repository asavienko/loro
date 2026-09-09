import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  LyricDocumentSchema,
  MusicLyricsRequestSchema,
  MusicLyricsResponseSchema,
  MusicRendersRequestSchema,
  MusicTrackResponseSchema,
  MusicV2CompositionPlanSchema,
} from './music.js'
import { isSyncEntity } from '../sync/fieldPolicy.js'
import { draftOperations } from './draft.js'

const cafe = ['cafe1', 'cafe2', 'cafe3'] as const
const document = {
  schema_version: 1,
  target_locale: 'es-ES',
  meaning_language: 'en',
  catalog_version: 1,
  phrase_ids: [...cafe],
  title: { target: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
  sections: [
    { name: 'Verse 1', lines: ['Me pone un cortado, por favor', '¿Tienen leche de avena?'] },
    { name: 'Chorus', lines: ['Me pone un cortado, por favor'] },
    { name: 'Verse 2', lines: ['Para llevar, por favor'] },
  ],
  used_phrases: [
    {
      catalog_phrase_id: 'cafe1',
      target_text: 'Me pone un cortado, por favor',
      section_name: 'Verse 1',
      line_index: 0,
      match: 'exact_line',
    },
    {
      catalog_phrase_id: 'cafe2',
      target_text: '¿Tienen leche de avena?',
      section_name: 'Verse 1',
      line_index: 1,
      match: 'exact_line',
    },
    {
      catalog_phrase_id: 'cafe3',
      target_text: 'Para llevar, por favor',
      section_name: 'Verse 2',
      line_index: 0,
      match: 'exact_line',
    },
  ],
  gloss_lines: [
    { target: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
    { target: '¿Tienen leche de avena?', translation: 'Do you have oat milk?' },
    { target: 'Para llevar, por favor', translation: 'To go, please' },
  ],
}

const audioKeys = [
  'pcm',
  'recording',
  'audio_path',
  'audio_bytes',
  'asr',
  'transcript',
  'conditioning_ref',
  'AudioRefChunk',
  'voice_clone',
  'user_phrase_id',
]

function propertyNames(schema: z.ZodType): string[] {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'throw' })
  const names: string[] = []
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return
    if ('properties' in value && typeof value.properties === 'object' && value.properties) {
      names.push(...Object.keys(value.properties))
      for (const child of Object.values(value.properties)) visit(child)
    }
    if ('$ref' in value) return
    for (const child of Object.values(value)) visit(child)
  }
  visit(json)
  return names
}

describe('music draft contracts (p3f-02)', () => {
  it('accepts a lyric document and rejects duplicate or short phrase lists', () => {
    expect(LyricDocumentSchema.safeParse(document).success).toBe(true)
    expect(
      MusicLyricsRequestSchema.safeParse({
        target_locale: 'es-ES',
        meaning_language: 'en',
        catalog_phrase_ids: [...cafe],
      }).success,
    ).toBe(true)
    expect(
      MusicLyricsRequestSchema.safeParse({
        target_locale: 'es-ES',
        meaning_language: 'en',
        catalog_phrase_ids: ['cafe1', 'cafe1', 'cafe2'],
      }).success,
    ).toBe(false)
    expect(
      MusicLyricsRequestSchema.safeParse({
        target_locale: 'es-ES',
        meaning_language: 'en',
        catalog_phrase_ids: ['cafe1', 'cafe2'],
      }).success,
    ).toBe(false)
    expect(
      MusicLyricsRequestSchema.safeParse({
        target_locale: 'bg-BG',
        meaning_language: 'en',
        catalog_phrase_ids: ['bg-BG:cafe1', 'bg-BG:cafe2', 'bg-BG:cafe3'],
      }).success,
    ).toBe(true)
  })

  it('omits recording, ASR, and conditioning fields from every music schema', () => {
    for (const schema of [
      LyricDocumentSchema,
      MusicLyricsRequestSchema,
      MusicLyricsResponseSchema,
      MusicRendersRequestSchema,
      MusicTrackResponseSchema,
      MusicV2CompositionPlanSchema,
    ]) {
      const names = propertyNames(schema)
      for (const key of audioKeys) expect(names, key).not.toContain(key)
    }
  })

  it('registers draft music operations behind the plan-local Q-21 gate', () => {
    const ids = draftOperations.map((operation) => operation.id)
    expect(ids).toEqual(expect.arrayContaining(['musicLyrics', 'musicRenders', 'musicTrack']))
    for (const id of ['musicLyrics', 'musicRenders', 'musicTrack']) {
      const operation = draftOperations.find((entry) => entry.id === id)
      expect(operation?.status).toBe('draft')
      expect(operation?.auth).toBe('bearer')
      expect(operation?.gates).toEqual(['Q-21'])
      expect(operation?.unresolved?.length).toBeGreaterThan(0)
    }
  })

  it('does not add a sync entity for local-only lyric or track rows', () => {
    expect(isSyncEntity('music_job')).toBe(false)
    expect(isSyncEntity('music_track')).toBe(false)
    expect(isSyncEntity('lyric_document')).toBe(false)
  })

  it('rejects a v1 MusicPrompt-shaped plan that uses sections instead of chunks', () => {
    expect(
      MusicV2CompositionPlanSchema.safeParse({
        context_adherence: 'high',
        sections: [{ lines: ['hello'] }],
      }).success,
    ).toBe(false)
    expect(
      MusicV2CompositionPlanSchema.safeParse({
        context_adherence: 'high',
        chunks: [
          {
            text: '[Verse 1]\nMe pone un cortado, por favor',
            duration_ms: 12_000,
            positive_styles: ['acoustic guitar'],
            negative_styles: [],
          },
        ],
      }).success,
    ).toBe(true)
  })
})
