/**
 * The `translate` stage request (plan 112 §3, ADR-0017): one set into one interface language,
 * from the target and its English pivot. The model gets the scene, every phrase with its English
 * and its English glosses word by word, and is asked for the same words glossed in the learner's
 * language, so the code can align the answer with the phrase instead of trusting it.
 */
import { z } from 'zod'
import type { V2Language } from '@loro/content/v2'
import { hashJson } from '../hash.js'
import type { Slot } from '../slot.js'
import { LANGUAGE_NAMES, type BuiltRequest } from './phrases.js'

export const TRANSLATE_PROMPT_VERSION = 'translate.v1'
export const TRANSLATE_TEMPERATURE = 0.2
export const TRANSLATE_SEED = 112

/** The interface languages other than English (the pivot), by their file suffix. */
export const INTERFACE_LANGS = { bg: 'bg-BG', ru: 'ru-RU', pl: 'pl-PL', cs: 'cs-CZ' } as const
export type InterfaceLang = keyof typeof INTERFACE_LANGS

export interface TranslateInput {
  id: string
  target: string
  english: string
  /** The English glosses, in phrase order; the answer must gloss the same words in the same order. */
  words: { w: string; gloss: string }[]
}

export const TRANSLATE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['subtitle', 'phrases'],
  properties: {
    subtitle: { type: 'string', description: "The set subtitle in the learner's language." },
    phrases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'translation', 'glosses'],
        properties: {
          n: { type: 'integer' },
          translation: {
            type: 'string',
            description: "What a speaker of the learner's language says in that moment.",
          },
          glosses: {
            type: 'array',
            description: "One gloss per listed word, in the same order, in the learner's language.",
            items: { type: 'string' },
          },
        },
      },
    },
  },
}

export const RawTranslateAnswer = z.object({
  subtitle: z.string(),
  phrases: z.array(z.object({ n: z.int(), translation: z.string(), glosses: z.array(z.string()) })),
})
export type RawTranslateAnswer = z.infer<typeof RawTranslateAnswer>

/** How each interface language glosses an article of the target: exact strings, so writer and judge agree. */
export const ARTICLE_GLOSSES: Record<InterfaceLang, { definite: string; indefinite: string }> = {
  bg: { definite: '(определителен член: -ът/-та/-то/-те)', indefinite: 'един/една/едно' },
  ru: { definite: '(определённый артикль)', indefinite: '(неопределённый артикль)' },
  pl: { definite: '(rodzajnik określony)', indefinite: '(rodzajnik nieokreślony)' },
  cs: { definite: '(určitý člen)', indefinite: '(neurčitý člen)' },
}

/** The target languages that have articles, and which words they are. */
const ARTICLES: Partial<Record<V2Language, { definite: string[]; indefinite: string[] }>> = {
  'es-ES': { definite: ['el', 'la', 'los', 'las'], indefinite: ['un', 'una', 'unos', 'unas'] },
  'en-GB': { definite: ['the'], indefinite: ['a', 'an'] },
  'en-US': { definite: ['the'], indefinite: ['a', 'an'] },
}

/**
 * The gloss convention, the same text in the translate and the judge prompts (plan 112 §3): what
 * the two must agree on cannot be left to either one's taste.
 */
export function glossConvention(course: V2Language, lang: InterfaceLang): string[] {
  const target = LANGUAGE_NAMES[course]
  const own = LANGUAGE_NAMES[INTERFACE_LANGS[lang]]
  const articles = ARTICLES[course]
  const glosses = ARTICLE_GLOSSES[lang]
  return [
    `Gloss convention (the learner reads each gloss against the ${target} word, not against the ${own} line):`,
    `- A gloss gives the ${target} word's meaning in this phrase, in ${own}, in the form the ${target} word has (its person, number, tense); it may differ from the word the line uses.`,
    ...(articles
      ? [
          `- ${articles.definite.join(', ')} → exactly «${glosses.definite}»; ${articles.indefinite.join(', ')} → exactly «${glosses.indefinite}».`,
        ]
      : []),
    `- A preposition, pronoun or particle → its meaning here, in one or two ${own} words; where ${own} has no word for it, its role in parentheses.`,
    `- A noun or adjective → its ${own} equivalent in the dictionary form (nominative; adjectives masculine singular), plural if the ${target} word is plural.`,
    `- A fixed multi-word unit listed as one word (e.g. «para llevar», «café con leche») → one gloss for the unit.`,
    `- A word that is the same in both languages, or a dish or drink name, stays as it is.`,
    `- Never English.`,
  ]
}

export function translateSystemPrompt(course: V2Language, lang: InterfaceLang): string {
  const target = LANGUAGE_NAMES[course]
  const own = LANGUAGE_NAMES[INTERFACE_LANGS[lang]]
  return [
    `You translate ${target} phrases for ${own}-speaking learners of ${target}. The learner hears your`,
    `${own} first, then says the ${target} phrase aloud, so your line is what a ${own} speaker would say in that`,
    'moment: natural, the same register and tone, the same length, never word for word and never an',
    'explanation. The English line shows the meaning the writer intended; follow it where the',
    `${target} is ambiguous.`,
    '',
    ...glossConvention(course, lang),
    '',
    'Answer with JSON matching the schema and nothing else.',
  ].join('\n')
}

function block(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

export function buildTranslateRequest(
  slot: Slot,
  inputs: readonly TranslateInput[],
  lang: InterfaceLang,
  subtitleEn: string,
  model: string,
  /** Problems with an earlier answer, by phrase number, so the model does not repeat them. */
  prior: readonly string[] = [],
): BuiltRequest {
  const native = INTERFACE_LANGS[lang]
  const own = LANGUAGE_NAMES[native]
  const { brief } = slot
  const blocks = [
    block('The set', [
      `${inputs.length} phrases in ${LANGUAGE_NAMES[slot.course]} at level ${slot.level}.`,
      `Scene: ${brief.scene}`,
      `Speakers: ${brief.speakers.join(' and ')}. Register: ${brief.register}.`,
      `English subtitle: ${subtitleEn}`,
      ...(brief.mention.length > 0
        ? ['Background the writer was given:', ...brief.mention.map((m) => `- ${m}`)]
        : []),
    ]),
    block(
      'Phrases',
      inputs.map((p, i) =>
        JSON.stringify({
          n: i + 1,
          target: p.target,
          english: p.english,
          words: p.words.map((w) => `${w.w} = ${w.gloss}`),
        }),
      ),
    ),
    block('Task', [
      `Give the subtitle in ${own}, and for each phrase, by number, its ${own} line and one ${own} gloss per listed word, in order.`,
      `Return exactly ${inputs.length} phrases, numbered 1 to ${inputs.length}; each \`glosses\` list has as many entries as that phrase's \`words\`.`,
    ]),
    ...(prior.length > 0
      ? [
          block('Sent back', [
            'These phrases were sent back by the checks or the editor; fix exactly what is named:',
            ...prior.map((p) => `- ${p}`),
          ]),
        ]
      : []),
  ]
  const system = translateSystemPrompt(slot.course, lang)
  const user = blocks.join('\n\n')
  const body = {
    system,
    user,
    schema: TRANSLATE_SCHEMA,
    model,
    promptVersion: TRANSLATE_PROMPT_VERSION,
    temperature: TRANSLATE_TEMPERATURE,
    seed: TRANSLATE_SEED,
    prior,
  }
  return {
    system,
    messages: [{ role: 'user', content: user }],
    schema: TRANSLATE_SCHEMA,
    temperature: TRANSLATE_TEMPERATURE,
    seed: TRANSLATE_SEED,
    cacheKey: hashJson(body),
    promptVersion: TRANSLATE_PROMPT_VERSION,
    briefHash: hashJson(brief),
  }
}
