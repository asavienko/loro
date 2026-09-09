/**
 * Authoring-time phrase/scenario drafts (AI-02 / plan 97).
 * `review_required: true` is mandatory. These files never load through `loadCatalog`.
 */
import { z } from 'zod'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { PHRASE_SUGGEST_MAX_WORDS, phraseWordCount } from '@loro/core'

const pairOk = (value: { native_language: string; target_locale: string }) =>
  supportsPair(value.native_language, value.target_locale)

export const PhraseAuthoringDraftSchema = z
  .strictObject({
    review_required: z.literal(true),
    topic: z.string().trim().min(1).max(80),
    target_locale: z.enum(TARGET_LOCALES),
    native_language: z.enum(NATIVE_LANGUAGES),
    phrases: z
      .array(
        z.strictObject({
          target_text: z.string().trim().min(1).max(120),
          translation: z.string().trim().min(1).max(140),
          theme: z.string().min(1).max(32),
          emoji: z.string().min(1).max(8),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine(pairOk, 'Unsupported language pair')
  .superRefine((draft, ctx) => {
    for (const [index, phrase] of draft.phrases.entries()) {
      if (phraseWordCount(phrase.target_text) > PHRASE_SUGGEST_MAX_WORDS) {
        ctx.addIssue({
          code: 'custom',
          path: ['phrases', index, 'target_text'],
          message: 'Draft lines stay within the spoken-practice word cap',
        })
      }
    }
  })

export type PhraseAuthoringDraft = z.infer<typeof PhraseAuthoringDraftSchema>

const STUB_TARGET: Record<(typeof TARGET_LOCALES)[number], (topic: string) => string> = {
  'es-ES': (topic) => `Necesito ayuda con ${topic}.`,
  'bg-BG': (topic) => `Имам нужда от помощ с ${topic}.`,
  'ru-RU': (topic) => `Мне нужна помощь с ${topic}.`,
}

const STUB_MEANING: Record<(typeof NATIVE_LANGUAGES)[number], (topic: string) => string> = {
  en: (topic) => `I need help with ${topic}.`,
  bg: (topic) => `Имам нужда от помощ с ${topic}.`,
  ru: (topic) => `Мне нужна помощь с ${topic}.`,
}

/** Stub drafter — no network. Live model output is a later authoring-tool concern. */
export function stubPhraseDraft(input: {
  readonly topic: string
  readonly target_locale: (typeof TARGET_LOCALES)[number]
  readonly native_language: (typeof NATIVE_LANGUAGES)[number]
}): PhraseAuthoringDraft {
  const topic = input.topic.trim() || 'topic'
  const draft: PhraseAuthoringDraft = {
    review_required: true,
    topic,
    target_locale: input.target_locale,
    native_language: input.native_language,
    phrases: [
      {
        target_text: STUB_TARGET[input.target_locale](topic),
        translation: STUB_MEANING[input.native_language](topic),
        theme: 'Survival',
        emoji: '📝',
      },
    ],
  }
  return PhraseAuthoringDraftSchema.parse(draft)
}

export function parsePhraseAuthoringDraft(value: unknown): PhraseAuthoringDraft {
  return PhraseAuthoringDraftSchema.parse(value)
}
