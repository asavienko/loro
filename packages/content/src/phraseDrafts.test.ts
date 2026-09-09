import { describe, expect, it } from 'vitest'
import { parseDraftPhraseArgs } from './draftPhrases.js'
import { parsePhraseAuthoringDraft, stubPhraseDraft } from './phraseDrafts.js'
import { loadCatalog } from './index.js'

describe('authoring-time phrase drafts', () => {
  it('requires review_required and never loads through the bundled catalog', () => {
    const draft = stubPhraseDraft({
      topic: 'pharmacy',
      target_locale: 'es-ES',
      native_language: 'en',
    })
    expect(draft.review_required).toBe(true)
    expect(parsePhraseAuthoringDraft(draft).phrases).toHaveLength(1)
    expect(() =>
      parsePhraseAuthoringDraft({ ...draft, review_required: false }),
    ).toThrow()
    expect(loadCatalog().phrases.some((phrase) => 'review_required' in phrase)).toBe(false)
    expect(() =>
      parsePhraseAuthoringDraft({
        ...draft,
        phrases: [{ ...draft.phrases[0], theme: 'not-a-real-theme' }],
      }),
    ).toThrow()
  })

  it('drafts the active pair rather than substituting Spanish', () => {
    const draft = stubPhraseDraft({
      topic: 'pharmacy',
      target_locale: 'bg-BG',
      native_language: 'en',
    })
    expect(draft.phrases[0]?.target_text).toContain('Имам нужда')
    expect(draft.phrases[0]?.target_text.includes('Necesito')).toBe(false)
  })

  it('requires explicit topic, target and native flags', () => {
    expect(() => parseDraftPhraseArgs([])).toThrow(/required/)
    expect(() => parseDraftPhraseArgs(['--targt', 'es-ES', '--topic', 'x', '--native', 'en'])).toThrow(
      /unknown flag/,
    )
    expect(parseDraftPhraseArgs(['--topic', 'pharmacy', '--target', 'bg-BG', '--native', 'en'])).toEqual(
      {
        topic: 'pharmacy',
        target_locale: 'bg-BG',
        native_language: 'en',
      },
    )
  })
})
