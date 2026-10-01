/**
 * The `phrases` stage request (plan 112 §3, "Building a request"): a pure function of the slot and
 * the context read from disk. Fixed blocks in a fixed order, each within a budget, so the model,
 * which remembers nothing between calls, is told everything: the scene, the variation card, the
 * grammar with its rule, the words to use and to avoid, the phrases already written nearby,
 * hand-written examples in the exact output shape, and the format. The same inputs give the same
 * bytes; two slots give different ones.
 */
import { z } from 'zod'
import type { V2Language } from '@loro/content/v2'
import { fold, type AuthoringContext, type KnownPhrase } from '../context.js'
import { hashJson, pickSome, variationCard } from '../hash.js'
import { MAX_CHARS, MAX_WORDS, type Slot } from '../slot.js'

export const PROMPT_VERSION = 'phrases.v1'
/** Fixed and low: the request, not sampling, is where variety comes from. */
export const TEMPERATURE = 0.3
export const SEED = 112
/** Candidates asked for over the places to fill: the checks drop the weak ones. */
export const CANDIDATE_SURPLUS = 3
/** Siblings shown to the model: the newest first, so a long topic still fits the budget. */
export const MAX_SIBLINGS = 60
export const EXAMPLES = 3

export const LANGUAGE_NAMES: Record<V2Language, string> = {
  'en-GB': 'British English',
  'en-US': 'American English',
  'es-ES': 'Spanish (Spain)',
  'bg-BG': 'Bulgarian',
  'ru-RU': 'Russian',
  'pl-PL': 'Polish',
  'cs-CZ': 'Czech',
}

const SCRIPTS: Record<V2Language, 'Latin' | 'Cyrillic'> = {
  'en-GB': 'Latin',
  'en-US': 'Latin',
  'es-ES': 'Latin',
  'bg-BG': 'Cyrillic',
  'ru-RU': 'Cyrillic',
  'pl-PL': 'Latin',
  'cs-CZ': 'Latin',
}

export const PHRASES_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'subtitle_en', 'phrases'],
  properties: {
    title: {
      type: 'string',
      description: 'The set title in the target language, at most four words.',
    },
    subtitle_en: {
      type: 'string',
      description: 'One short line in English saying what the set is for.',
    },
    phrases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'target',
          'en_GB',
          'en_US',
          'register',
          'words',
          'grammar',
          'functions',
          'uses',
          'icons',
        ],
        properties: {
          target: { type: 'string' },
          en_GB: { type: 'string' },
          en_US: { type: 'string' },
          register: { type: 'string', enum: ['formal', 'informal', 'neutral'] },
          words: {
            type: 'array',
            description: 'Every word of the target in order, each with its English gloss.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['w', 'gloss_en'],
              properties: { w: { type: 'string' }, gloss_en: { type: 'string' } },
            },
          },
          grammar: { type: 'array', items: { type: 'string' } },
          functions: { type: 'array', items: { type: 'string' } },
          uses: { type: 'array', items: { type: 'string' } },
          icons: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

export const RawPhrasesAnswer = z.object({
  title: z.string(),
  subtitle_en: z.string(),
  phrases: z.array(
    z.object({
      target: z.string(),
      en_GB: z.string(),
      en_US: z.string(),
      register: z.enum(['formal', 'informal', 'neutral']),
      words: z.array(z.object({ w: z.string(), gloss_en: z.string() })),
      grammar: z.array(z.string()),
      functions: z.array(z.string()),
      uses: z.array(z.string()),
      icons: z.array(z.string()),
    }),
  ),
})
export type RawPhrasesAnswer = z.infer<typeof RawPhrasesAnswer>
export type RawCandidate = RawPhrasesAnswer['phrases'][number]

export interface BuiltRequest {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  schema: Record<string, unknown>
  temperature: number
  seed: number
  /** What the cache is keyed by: the request itself, the model and the prompt version. */
  cacheKey: string
  promptVersion: string
  briefHash: string
}

/** A previous attempt's rejects, fed back so the model does not repeat them (plan 112 §3). */
export interface PriorAttempt {
  rejected: { target: string; reason: string }[]
  /** `mustUse` words the accepted candidates still miss. */
  missing: string[]
  /** Places still to fill. */
  needed: number
}

export function systemPrompt(course: V2Language): string {
  const target = LANGUAGE_NAMES[course]
  return [
    `You write ${target} phrases for Loro, an app that teaches a language phrase by phrase. The learner hears a`,
    'phrase in English, says it aloud in the language they are learning, then hears it said.',
    '',
    'Rules:',
    `1. Correct, natural ${target} that people really say in the scene described: no textbook sentences, no translationese.`,
    '2. Each phrase is said in one breath. Keep to the word and character limits given.',
    '3. Follow the brief exactly: use the words it lists, never the words or themes it bans, show the grammar it names.',
    '4. Never repeat or paraphrase a phrase listed as already written; say something those phrases do not.',
    '5. `en_GB` and `en_US` are what an English speaker would say in that moment (not word for word); they differ only where British and American usage differ.',
    '6. `words` lists every word of the target in order, as written, each with a short English gloss of its meaning in this phrase; a fixed multi-word unit (e.g. «para llevar») may be one entry.',
    "7. `uses` lists which of the brief's must-use words this phrase contains, spelled as the brief spells them; `grammar` lists which of the brief's grammar ids it shows; `functions` which of its functions it performs.",
    '8. `icons` names one to three pictures from the icon list, the main subject first.',
    '9. Mix questions, requests, answers and short remarks between the speakers; vary the openings.',
    '10. No numbering, quotation marks or notes inside the phrase itself. No brand names.',
    '',
    'Answer with JSON matching the schema and nothing else.',
  ].join('\n')
}

function block(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

function lemmaLine(l: { lemma: string; gloss: string; pos: string }): string {
  return `- ${l.lemma} (${l.pos}: ${l.gloss})`
}

function exampleJson(p: KnownPhrase): string {
  const words = Object.entries(p.words ?? {}).map(([w, gloss_en]) => ({ w, gloss_en }))
  return JSON.stringify({
    target: p.target,
    en_GB: p.english,
    en_US: p.english,
    register: p.register ?? 'neutral',
    words,
    grammar: [],
    functions: [],
    uses: [],
    icons: p.image ?? [],
  })
}

/** Hand-written phrases of this course at this level (or the nearest), picked by the slot. */
export function examplesFor(slot: Slot, context: AuthoringContext): KnownPhrase[] {
  const handWritten = context.phrases.filter((p) => p.words !== undefined && p.setId !== slot.setId)
  const atLevel = handWritten.filter((p) => p.level === slot.level)
  const pool = atLevel.length >= EXAMPLES ? atLevel : handWritten
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1))
  return pickSome(sorted, slot.setId, 'example', EXAMPLES)
}

/** The accepted phrases of the same topic and level, newest first, capped. */
export function siblingsFor(slot: Slot, context: AuthoringContext): KnownPhrase[] {
  return context.phrases
    .filter((p) => p.topicId === slot.topic && p.level === slot.level && p.setId !== slot.setId)
    .slice(-MAX_SIBLINGS)
    .reverse()
}

export function buildPhrasesRequest(
  slot: Slot,
  context: AuthoringContext,
  model: string,
  prior?: PriorAttempt,
): BuiltRequest {
  const { brief } = slot
  const maxWords = MAX_WORDS[slot.level]
  const mustUse = brief.mustUse.map((l) => l.lemma)
  const card = variationCard(slot.setId, mustUse)
  const needed = prior?.needed ?? slot.count
  const candidates = needed + CANDIDATE_SURPLUS
  const siblings = siblingsFor(slot, context)
  const examples = examplesFor(slot, context)
  const icons = pickIcons(context.icons, brief, slot)

  const blocks: string[] = [
    block('Task', [
      `Write ${candidates} candidate phrases in ${LANGUAGE_NAMES[slot.course]} for one set at level ${slot.level}; the best ${needed} will be kept.`,
      `Each phrase: at most ${maxWords} words and ${MAX_CHARS} characters, in the ${SCRIPTS[slot.course]} script.`,
      `Set title: in ${LANGUAGE_NAMES[slot.course]}, at most four words. Subtitle: one short English line.`,
    ]),
    block('Scene', [
      brief.scene,
      `Speakers: ${brief.speakers.join(' and ')}.`,
      `Register: ${brief.register}.`,
      ...(brief.variety ? [`Variety: ${brief.variety}.`] : []),
      ...(brief.mention.length > 0 ? ['Keep in mind:', ...brief.mention.map((m) => `- ${m}`)] : []),
      ...(brief.doNotMention.length > 0
        ? ['Do not mention:', ...brief.doNotMention.map((m) => `- ${m}`)]
        : []),
    ]),
    block('This set in particular', [
      `The customer is ${card.mood}.`,
      `Order of speech acts across the set: ${card.actOrder}.`,
      `Start with phrases that use: ${card.anchors.join(', ')}.`,
    ]),
    block('Grammar to show', [
      ...brief.grammarFocus.flatMap((g) => [
        `- ${g.id} (${g.kind}), in at least ${g.minPhrases} phrases: ${g.rule}`,
        `  Example: ${g.example}`,
      ]),
    ]),
    block('Words to use', [
      `Each of these must appear in at least one phrase (spell it as given, inflected as the sentence needs, and list it in \`uses\`):`,
      ...brief.mustUse.map(lemmaLine),
      ...(brief.shouldUse.length > 0
        ? ['Use where natural:', ...brief.shouldUse.map(lemmaLine)]
        : []),
      `Functions to perform across the set: ${brief.functions.join(', ')}.`,
    ]),
    block('Words and themes not to use', [
      ...(brief.avoid.lemmas.length > 0 ? [`Words: ${brief.avoid.lemmas.join(', ')}.`] : []),
      ...(brief.avoid.themes.length > 0 ? [`Themes: ${brief.avoid.themes.join(', ')}.`] : []),
    ]),
    block(
      'Already written in this topic at this level (do not repeat or paraphrase)',
      siblings.length > 0 ? siblings.map((p) => `- ${p.target}`) : ['(nothing yet)'],
    ),
    block(
      'Examples of the output shape (from the course; do not copy them)',
      examples.map(exampleJson),
    ),
    block('Icons you may use', [icons.join(', ')]),
  ]
  if (prior) {
    blocks.push(
      block('Previous attempt', [
        `Your earlier answer had ${prior.rejected.length} phrases rejected. Do not repeat them or their mistakes:`,
        ...prior.rejected.map((r) => `- «${r.target}»: ${r.reason}`),
        ...(prior.missing.length > 0
          ? [
              `These must-use words are still missing; the new phrases must cover them: ${prior.missing.join(', ')}.`,
            ]
          : []),
        `Write ${candidates} new candidates for the ${needed} places left.`,
      ]),
    )
  }
  blocks.push(block('Format', ['JSON only, matching the schema. Field names exactly as given.']))

  const system = systemPrompt(slot.course)
  const user = blocks.join('\n\n')
  const briefHash = hashJson(brief)
  const body = {
    system,
    user,
    schema: PHRASES_SCHEMA,
    model,
    promptVersion: PROMPT_VERSION,
    temperature: TEMPERATURE,
    seed: SEED,
  }
  return {
    system,
    messages: [{ role: 'user', content: user }],
    schema: PHRASES_SCHEMA,
    temperature: TEMPERATURE,
    seed: SEED,
    cacheKey: hashJson(body),
    promptVersion: PROMPT_VERSION,
    briefHash,
  }
}

/**
 * The icon list is long; the model sees the ones that match the brief's words by name plus a fixed
 * general set, so the block stays small and the same for the same brief.
 */
const GENERAL_ICONS = [
  'local_cafe',
  'restaurant',
  'payments',
  'credit_card',
  'shopping_bag',
  'help',
  'thumb_up',
  'waving_hand',
  'chat',
  'schedule',
  'location_on',
  'water_drop',
  'local_drink',
  'bakery_dining',
  'table_restaurant',
  'wifi',
  'wc',
  'ac_unit',
  'whatshot',
]

function pickIcons(all: readonly string[], brief: Slot['brief'], slot: Slot): string[] {
  const words = new Set<string>()
  for (const l of [...brief.mustUse, ...brief.shouldUse]) {
    for (const token of fold(`${l.lemma} ${l.gloss}`).split(' '))
      if (token.length > 2) words.add(token)
  }
  for (const token of fold(`${slot.topic} ${slot.situation}`).split('-')) words.add(token)
  const matched = all.filter((icon) => icon.split('_').some((part) => words.has(part)))
  const general = GENERAL_ICONS.filter((icon) => all.includes(icon))
  return [...new Set([...general, ...matched])].sort()
}

/** A compact description of a built request for logs and estimates. */
export function describe(request: BuiltRequest): { bytes: number; approxTokens: number } {
  const bytes = Buffer.byteLength(
    request.system + request.messages.map((m) => m.content).join(''),
    'utf8',
  )
  return { bytes, approxTokens: Math.round(bytes / 3.6) }
}
