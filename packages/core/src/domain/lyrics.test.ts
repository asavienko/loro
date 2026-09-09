import { describe, expect, it } from 'vitest'
import { lyricDocumentToCompositionPlan, planSectionDurations } from './lyric-plan.js'
import {
  bundledLyricDocument,
  foldLyricText,
  looksLikeTargetLanguage,
  validateLyricDocument,
  type CatalogLyricLine,
} from './lyrics.js'

const phrases: CatalogLyricLine[] = [
  { id: 'cafe1', targetText: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
  { id: 'cafe2', targetText: '¿Tienen leche de avena?', translation: 'Do you have oat milk?' },
  { id: 'cafe3', targetText: 'Para llevar, por favor', translation: 'To go, please' },
]

const catalog: CatalogLyricLine[] = [
  ...phrases,
  { id: 'cafe4', targetText: 'La cuenta, por favor', translation: 'The bill, please' },
]

const extraCatalog = [
  ...catalog,
  { id: 'din1', targetText: '¿Qué me recomienda?', translation: 'What do you recommend?' },
]

describe('lyric phrase coverage (p3f-04)', () => {
  it('accepts the bundled floor and covers every selected phrase', () => {
    const document = bundledLyricDocument(phrases, 'es-ES', 'en', 1)
    const result = validateLyricDocument(document, phrases, extraCatalog)
    expect(result.ok).toBe(true)
    expect(document.sections).toHaveLength(3)
    expect(planSectionDurations(document.sections.length).reduce((a, b) => a + b, 0)).toBe(45_000)
  })

  it('matches Spanish accents after NFC and a single-space fold', () => {
    expect(foldLyricText('  ¿Dónde   está? ')).toBe('donde esta')
    const document = bundledLyricDocument(
      [
        { id: 'x1', targetText: '¿Dónde está?', translation: 'Where is it?' },
        { id: 'x2', targetText: 'Está bien', translation: 'It is fine' },
        { id: 'x3', targetText: 'Por favor', translation: 'Please' },
      ],
      'es-ES',
      'en',
      1,
    )
    const mutated = {
      ...document,
      sections: document.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              lines: ['Oye, ¿dónde está el baño?', 'Está bien', 'Por favor'],
            }
          : section,
      ),
      used_phrases: document.used_phrases.map((used) =>
        used.catalog_phrase_id === 'x1' ? { ...used, match: 'contiguous_span' as const } : used,
      ),
    }
    mutated.used_phrases = mutated.used_phrases.map((used) =>
      used.catalog_phrase_id === 'x1'
        ? { ...used, section_name: 'Verse 1', line_index: 0, match: 'contiguous_span' }
        : used,
    )
    expect(
      validateLyricDocument(mutated, [
        { id: 'x1', targetText: '¿Dónde está?', translation: 'Where is it?' },
        { id: 'x2', targetText: 'Está bien', translation: 'It is fine' },
        { id: 'x3', targetText: 'Por favor', translation: 'Please' },
      ]).ok,
    ).toBe(true)
  })

  it('does not fold away Cyrillic ё or й', () => {
    expect(foldLyricText('ёлка')).toBe('ёлка')
    expect(foldLyricText('йод')).toBe('йод')
    expect(looksLikeTargetLanguage('Добро утро', 'bg-BG')).toBe(true)
    expect(looksLikeTargetLanguage('Доброе утро', 'ru-RU')).toBe(true)
    expect(looksLikeTargetLanguage('Good morning', 'ru-RU')).toBe(false)
  })

  it('rejects missing phrases, invented catalog lines, fake scores, and two-section plans', () => {
    const document = bundledLyricDocument(phrases, 'es-ES', 'en', 1)
    const missing = {
      ...document,
      sections: [
        { name: 'Verse 1' as const, lines: [phrases[0]!.targetText] },
        { name: 'Chorus' as const, lines: [phrases[0]!.targetText] },
        { name: 'Verse 2' as const, lines: [phrases[0]!.targetText] },
      ],
    }
    expect(validateLyricDocument(missing, phrases).ok).toBe(false)

    const invented = {
      ...document,
      sections: document.sections.map((section, index) =>
        index === 2 ? { ...section, lines: [...section.lines, 'La cuenta, por favor'] } : section,
      ),
    }
    expect(validateLyricDocument(invented, phrases, extraCatalog).ok).toBe(false)

    const scored = {
      ...document,
      sections: document.sections.map((section, index) =>
        index === 1 ? { ...section, lines: ['Tu streak es 12 y el score 98%'] } : section,
      ),
    }
    expect(validateLyricDocument(scored, phrases).ok).toBe(false)

    const short = {
      ...document,
      sections: document.sections.slice(0, 2),
    }
    const shortResult = validateLyricDocument(short, phrases)
    expect(shortResult.ok).toBe(false)
    if (!shortResult.ok) expect(shortResult.errors).toContain('duration_budget')
  })

  it('keeps the review title off the music_v2 chunks wire unless it is also a sung line', () => {
    const document = {
      ...bundledLyricDocument(phrases, 'es-ES', 'en', 1),
      title: { target: 'Unique Review Title', translation: 'Only For The Screen' },
    }
    const pack = {
      style_id: 'acoustic_folk' as const,
      pack_version: 1,
      positive_styles: [
        'acoustic guitar',
        'warm folk',
        'clear lead vocal',
        'gentle percussion',
        'intimate',
        'studio quality',
        'great production quality',
      ],
      negative_styles: ['screamed vocals'],
    }
    const plan = lyricDocumentToCompositionPlan(document, pack)
    expect(plan.chunks).toHaveLength(3)
    expect(JSON.stringify(plan)).not.toContain('Unique Review Title')
    expect(JSON.stringify(plan)).not.toContain('Only For The Screen')
    expect(JSON.stringify(plan)).not.toContain('conditioning_ref')
    expect('sections' in plan).toBe(false)
    expect(plan.context_adherence).toBe('high')
  })
})
