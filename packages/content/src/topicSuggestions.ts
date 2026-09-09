/**
 * Bundled Discover topic packs — the offline garnish for plan 97.
 * Pair-specific; an unknown pair returns nothing rather than Spanish.
 */
import type { NativeLanguage, TargetLocale, Theme } from '@loro/core'
import { queryHasKeyword, type PhraseCandidate } from '@loro/core'

export interface BundledLine {
  readonly targetText: string
  readonly translation: string
  readonly emoji: string
  readonly theme: Theme
}

interface TopicPack {
  readonly keywords: readonly string[]
  readonly lines: Readonly<
    Partial<Record<`${NativeLanguage}:${TargetLocale}`, readonly BundledLine[]>>
  >
}

const PHARMACY_ES_MEANING: Readonly<
  Record<NativeLanguage, readonly [pharmacy: string, headache: string, medicine: string]>
> = {
  en: [
    'Where is the all-night pharmacy?',
    'Do you have something for a headache?',
    'I need this medicine.',
  ],
  bg: [
    'Къде е дежурната аптека?',
    'Имате ли нещо против главоболие?',
    'Имам нужда от това лекарство.',
  ],
  ru: [
    'Где ночная аптека?',
    'У вас есть что-нибудь от головной боли?',
    'Мне нужно это лекарство.',
  ],
}

const pharmacyEs = (native: NativeLanguage): BundledLine[] => {
  const [pharmacy, headache, medicine] = PHARMACY_ES_MEANING[native]
  return [
    {
      targetText: '¿Dónde está la farmacia de guardia?',
      translation: pharmacy,
      emoji: '💊',
      theme: 'Survival',
    },
    {
      targetText: '¿Tiene algo para el dolor de cabeza?',
      translation: headache,
      emoji: '💊',
      theme: 'Survival',
    },
    {
      targetText: 'Necesito este medicamento.',
      translation: medicine,
      emoji: '💊',
      theme: 'Survival',
    },
  ]
}

const PHARMACY: TopicPack = {
  keywords: ['pharmacy', 'farmacia', 'chemist', 'аптека', 'drugstore', 'pharmacist', 'лекарств'],
  lines: {
    'en:es-ES': pharmacyEs('en'),
    'bg:es-ES': pharmacyEs('bg'),
    'ru:es-ES': pharmacyEs('ru'),
    'en:bg-BG': [
      {
        targetText: 'Къде е дежурната аптека?',
        translation: 'Where is the all-night pharmacy?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Имате ли нещо против главоболие?',
        translation: 'Do you have something for a headache?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Имам нужда от това лекарство.',
        translation: 'I need this medicine.',
        emoji: '💊',
        theme: 'Survival',
      },
    ],
    'ru:bg-BG': [
      {
        targetText: 'Къде е дежурната аптека?',
        translation: 'Где ночная аптека?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Имате ли нещо против главоболие?',
        translation: 'У вас есть что-нибудь от головной боли?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Имам нужда от това лекарство.',
        translation: 'Мне нужно это лекарство.',
        emoji: '💊',
        theme: 'Survival',
      },
    ],
    'en:ru-RU': [
      {
        targetText: 'Где ночная аптека?',
        translation: 'Where is the all-night pharmacy?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'У вас есть что-нибудь от головной боли?',
        translation: 'Do you have something for a headache?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Мне нужно это лекарство.',
        translation: 'I need this medicine.',
        emoji: '💊',
        theme: 'Survival',
      },
    ],
    'bg:ru-RU': [
      {
        targetText: 'Где ночная аптека?',
        translation: 'Къде е дежурната аптека?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'У вас есть что-нибудь от головной боли?',
        translation: 'Имате ли нещо против главоболие?',
        emoji: '💊',
        theme: 'Survival',
      },
      {
        targetText: 'Мне нужно это лекарство.',
        translation: 'Имам нужда от това лекарство.',
        emoji: '💊',
        theme: 'Survival',
      },
    ],
  },
}

const HAIRCUT: TopicPack = {
  keywords: ['haircut', 'hair', 'barber', 'peluquer', 'corte de pelo'],
  lines: {
    'en:es-ES': [
      {
        targetText: 'Quiero cortarme el pelo.',
        translation: "I'd like a haircut.",
        emoji: '✂️',
        theme: 'Shopping',
      },
      {
        targetText: '¿Puede dejarlo un poco más corto?',
        translation: 'Can you leave it a bit shorter?',
        emoji: '✂️',
        theme: 'Shopping',
      },
      {
        targetText: '¿Cuánto cuesta un corte?',
        translation: 'How much is a haircut?',
        emoji: '✂️',
        theme: 'Shopping',
      },
    ],
  },
}

const TOPICS: readonly TopicPack[] = [PHARMACY, HAIRCUT]

/** Stable Discover garnish identity for F-08 review hashing. */
export function topicReviewSnapshot(): readonly {
  readonly keywords: readonly string[]
  readonly lines: Readonly<Record<string, readonly BundledLine[]>>
}[] {
  return TOPICS.map((topic) => ({
    keywords: topic.keywords,
    lines: Object.fromEntries(Object.entries(topic.lines)),
  }))
}

export function bundledTopicSuggestions(
  query: string,
  nativeLanguage: NativeLanguage,
  targetLocale: TargetLocale,
): PhraseCandidate[] {
  const key = `${nativeLanguage}:${targetLocale}` as const
  for (const topic of TOPICS) {
    if (!topic.keywords.some((keyword) => queryHasKeyword(query, keyword))) continue
    const lines = topic.lines[key]
    if (lines === undefined) return []
    return lines.map((line) => ({
      targetText: line.targetText,
      translation: line.translation,
      theme: line.theme,
      emoji: line.emoji,
      provenance: 'bundled',
      source: 'generated',
      needsReview: true,
    }))
  }
  return []
}
