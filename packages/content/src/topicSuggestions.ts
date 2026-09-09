/**
 * Bundled Discover topic packs — the offline garnish for plan 97.
 * Pair-specific; an unknown pair returns nothing rather than Spanish.
 */
import type { NativeLanguage, TargetLocale, Theme } from '@loro/core'
import { canonicalPhraseText, type PhraseCandidate } from '@loro/core'

interface BundledLine {
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

const pharmacyEs = (translation: string): BundledLine[] => [
  {
    targetText: '¿Dónde está la farmacia de guardia?',
    translation,
    emoji: '💊',
    theme: 'Survival',
  },
  {
    targetText: '¿Tiene algo para el dolor de cabeza?',
    translation:
      translation === 'Where is the all-night pharmacy?'
        ? 'Do you have something for a headache?'
        : translation === 'Къде е дежурната аптека?'
          ? 'Имате ли нещо против главоболие?'
          : 'У вас есть что-нибудь от головной боли?',
    emoji: '💊',
    theme: 'Survival',
  },
  {
    targetText: 'Necesito este medicamento.',
    translation:
      translation === 'Where is the all-night pharmacy?'
        ? 'I need this medicine.'
        : translation === 'Къде е дежурната аптека?'
          ? 'Имам нужда от това лекарство.'
          : 'Мне нужно это лекарство.',
    emoji: '💊',
    theme: 'Survival',
  },
]

const PHARMACY: TopicPack = {
  keywords: ['pharmacy', 'farmacia', 'chemist', 'аптека', 'drugstore', 'pharmacist', 'лекарств'],
  lines: {
    'en:es-ES': pharmacyEs('Where is the all-night pharmacy?'),
    'bg:es-ES': pharmacyEs('Къде е дежурната аптека?'),
    'ru:es-ES': pharmacyEs('Где ночная аптека?'),
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

export function bundledTopicSuggestions(
  query: string,
  nativeLanguage: NativeLanguage,
  targetLocale: TargetLocale,
): PhraseCandidate[] {
  const folded = canonicalPhraseText(query)
  const key = `${nativeLanguage}:${targetLocale}` as const
  for (const topic of TOPICS) {
    if (!topic.keywords.some((keyword) => folded.includes(canonicalPhraseText(keyword)))) continue
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
