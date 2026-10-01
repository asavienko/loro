/**
 * The `judge` stage request (plan 112 §3): a second, strict look at a set's phrases before they
 * are written, by a model told the brief and the rules again (it remembers nothing of the first
 * call). It answers fixed questions per phrase, by number, so the policy in `judge.ts` is a
 * comparison of answers, not a reading of prose.
 */
import { z } from 'zod'
import { hashJson } from '../hash.js'
import { MAX_CHARS, MAX_WORDS, type Slot } from '../slot.js'
import { LANGUAGE_NAMES, type BuiltRequest } from './phrases.js'

export const JUDGE_PROMPT_VERSION = 'judge.v1'
export const JUDGE_TEMPERATURE = 0
export const JUDGE_SEED = 112

/** What the judge sees of a phrase: the text, its English and the glosses, nothing about who wrote it. */
export interface JudgeInput {
  target: string
  english: string
  words: { w: string; gloss: string }[]
  grammar: string[]
}

export const JUDGE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'n',
          'natural',
          'english',
          'level',
          'grammar_claim',
          'glosses',
          'brief',
          'duplicate_of',
          'fix',
          'note',
        ],
        properties: {
          n: { type: 'integer', description: 'The phrase number as given.' },
          natural: {
            type: 'string',
            enum: ['ok', 'awkward', 'wrong'],
            description:
              'ok: a native speaker says exactly this in the scene; awkward: understood but not how it is said; wrong: a grammar, agreement, spelling or word error.',
          },
          english: {
            type: 'string',
            enum: ['ok', 'loose', 'wrong'],
            description: 'Whether the English means the same as the phrase, in the same tone.',
          },
          level: {
            type: 'string',
            enum: ['ok', 'too_hard'],
            description: 'Whether a learner at this level can be expected to say it.',
          },
          grammar_claim: {
            type: 'string',
            enum: ['ok', 'wrong', 'none_claimed'],
            description: 'Whether the phrase really shows the grammar ids it claims.',
          },
          glosses: {
            type: 'string',
            enum: ['ok', 'wrong'],
            description: "Whether every word gloss gives that word's meaning in this phrase.",
          },
          brief: {
            type: 'string',
            enum: ['ok', 'violates'],
            description: 'Whether the phrase keeps to the register and the "do not mention" list.',
          },
          duplicate_of: {
            type: 'integer',
            description:
              'The number of an earlier phrase in this list that says the same thing in other words; 0 if none.',
          },
          fix: {
            type: 'string',
            description: 'The corrected phrase when natural is wrong or awkward; empty otherwise.',
          },
          note: {
            type: 'string',
            description: 'One short sentence saying why; empty when all ok.',
          },
        },
      },
    },
  },
}

export const RawJudgeAnswer = z.object({
  verdicts: z.array(
    z.object({
      n: z.int(),
      natural: z.enum(['ok', 'awkward', 'wrong']),
      english: z.enum(['ok', 'loose', 'wrong']),
      level: z.enum(['ok', 'too_hard']),
      grammar_claim: z.enum(['ok', 'wrong', 'none_claimed']),
      glosses: z.enum(['ok', 'wrong']),
      brief: z.enum(['ok', 'violates']),
      duplicate_of: z.int(),
      fix: z.string(),
      note: z.string(),
    }),
  ),
})
export type RawJudgeAnswer = z.infer<typeof RawJudgeAnswer>
export type RawVerdict = RawJudgeAnswer['verdicts'][number]

export function judgeSystemPrompt(course: Slot['course']): string {
  const target = LANGUAGE_NAMES[course]
  return [
    `You review ${target} phrases written for learners by another writer. You are a strict native editor from the`,
    'place the variety is spoken. The learner will say these phrases aloud and be understood or not, so an error',
    'that a native speaker would notice is "wrong", however small: agreement, gender, number, a missing article,',
    'a preposition, a word nobody uses in that scene.',
    '',
    'For every phrase, by its number, answer each question with one of the allowed values. Judge the phrase as',
    'it stands; do not reward effort. "awkward" means a native speaker understands it but would say it',
    'differently. When two phrases in the list say the same thing in slightly different words, mark the later',
    'one as a duplicate of the earlier. When you mark a phrase wrong or awkward, give the corrected phrase in',
    '`fix`, within the same word limit.',
    '',
    'Answer with JSON matching the schema and nothing else.',
  ].join('\n')
}

function block(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

export function buildJudgeRequest(
  slot: Slot,
  inputs: readonly JudgeInput[],
  model: string,
): BuiltRequest {
  const { brief } = slot
  const blocks = [
    block('The set', [
      `${inputs.length} phrases in ${LANGUAGE_NAMES[slot.course]} at level ${slot.level} (at most ${MAX_WORDS[slot.level]} words and ${MAX_CHARS} characters each).`,
      `Scene: ${brief.scene}`,
      `Speakers: ${brief.speakers.join(' and ')}. Register: ${brief.register}.`,
      ...(brief.variety ? [`Variety: ${brief.variety}.`] : []),
      ...(brief.doNotMention.length > 0
        ? ['The writer was told not to mention:', ...brief.doNotMention.map((m) => `- ${m}`)]
        : []),
    ]),
    block(
      'Grammar ids the phrases may claim',
      brief.grammarFocus.map((g) => `- ${g.id}: ${g.rule} (e.g. ${g.example})`),
    ),
    block(
      'Phrases',
      inputs.map((p, i) =>
        JSON.stringify({
          n: i + 1,
          target: p.target,
          english: p.english,
          words: p.words.map((w) => `${w.w} = ${w.gloss}`),
          claims: p.grammar,
        }),
      ),
    ),
    block('Questions, for every phrase', [
      '- natural: ok / awkward / wrong',
      '- english: ok / loose / wrong — does the English mean the same, in the same tone?',
      `- level: ok / too_hard for ${slot.level}`,
      '- grammar_claim: ok / wrong / none_claimed — does the phrase show the ids it claims?',
      "- glosses: ok / wrong — does every gloss give the word's meaning in this phrase?",
      '- brief: ok / violates — register and the "do not mention" list',
      '- duplicate_of: the number of an earlier phrase it merely rephrases, else 0',
      '- fix: the corrected phrase when not ok, else empty; note: why, in one short sentence',
      `Return exactly ${inputs.length} verdicts, numbered 1 to ${inputs.length}.`,
    ]),
  ]
  const system = judgeSystemPrompt(slot.course)
  const user = blocks.join('\n\n')
  const body = {
    system,
    user,
    schema: JUDGE_SCHEMA,
    model,
    promptVersion: JUDGE_PROMPT_VERSION,
    temperature: JUDGE_TEMPERATURE,
    seed: JUDGE_SEED,
  }
  return {
    system,
    messages: [{ role: 'user', content: user }],
    schema: JUDGE_SCHEMA,
    temperature: JUDGE_TEMPERATURE,
    seed: JUDGE_SEED,
    cacheKey: hashJson(body),
    promptVersion: JUDGE_PROMPT_VERSION,
    briefHash: hashJson(brief),
  }
}
