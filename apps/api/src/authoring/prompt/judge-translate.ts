/**
 * The `judge-translate` stage request (plan 112 §3): a strict native editor of the learner's
 * language looks at one set's lines and glosses next to the target and its English, and answers
 * fixed questions per phrase by number. On everything from the first batch: the spike showed about
 * one Russian line in five needs it.
 */
import { z } from 'zod'
import { hashJson } from '../hash.js'
import type { Slot } from '../slot.js'
import { LANGUAGE_NAMES, type BuiltRequest } from './phrases.js'
import { glossConvention, INTERFACE_LANGS, type InterfaceLang } from './translate.js'

export const JUDGE_TRANSLATE_PROMPT_VERSION = 'judge-translate.v1'

export interface JudgeTranslateInput {
  target: string
  english: string
  translation: string
  /** The word, its English gloss and the gloss under judgement. */
  glosses: { w: string; english: string; gloss: string }[]
}

export const JUDGE_TRANSLATE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'faithful', 'natural', 'register', 'glosses', 'bad_glosses', 'fix', 'note'],
        properties: {
          n: { type: 'integer' },
          faithful: {
            type: 'string',
            enum: ['ok', 'loose', 'wrong'],
            description: 'Whether the line means what the target (and its English) means.',
          },
          natural: {
            type: 'string',
            enum: ['ok', 'awkward', 'wrong'],
            description:
              'ok: a native speaker says exactly this; awkward: understood but not how it is said; wrong: a grammar, agreement or word error, or a word left in another language.',
          },
          register: {
            type: 'string',
            enum: ['ok', 'off'],
            description: 'Whether formality and tone match the target line.',
          },
          glosses: {
            type: 'string',
            enum: ['ok', 'wrong'],
            description:
              "Whether every gloss gives that word's meaning in this phrase, in the learner's language.",
          },
          bad_glosses: {
            type: 'array',
            items: { type: 'string' },
            description: 'The words whose gloss is wrong, spelled as listed; empty when all ok.',
          },
          fix: { type: 'string', description: 'The corrected line when not ok; empty otherwise.' },
          note: {
            type: 'string',
            description: 'One short sentence saying why; empty when all ok.',
          },
        },
      },
    },
  },
}

export const RawJudgeTranslateAnswer = z.object({
  verdicts: z.array(
    z.object({
      n: z.int(),
      faithful: z.enum(['ok', 'loose', 'wrong']),
      natural: z.enum(['ok', 'awkward', 'wrong']),
      register: z.enum(['ok', 'off']),
      glosses: z.enum(['ok', 'wrong']),
      bad_glosses: z.array(z.string()),
      fix: z.string(),
      note: z.string(),
    }),
  ),
})
export type RawJudgeTranslateAnswer = z.infer<typeof RawJudgeTranslateAnswer>
export type RawTranslateVerdict = RawJudgeTranslateAnswer['verdicts'][number]

function block(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

export function judgeTranslateSystemPrompt(course: Slot['course'], lang: InterfaceLang): string {
  const target = LANGUAGE_NAMES[course]
  const own = LANGUAGE_NAMES[INTERFACE_LANGS[lang]]
  return [
    `You review ${own} lines written for ${own}-speaking learners of ${target}. Each line is what the learner hears`,
    `before saying the ${target} phrase, so it must mean the same thing and be what a ${own} speaker really says in`,
    'that moment. You are a strict native editor: an error a native speaker would notice is "wrong", however small,',
    `and so is a word left in ${target} or English where ${own} has its own.`,
    '',
    `Each ${target} word also has a ${own} gloss, written under this convention:`,
    ...glossConvention(course, lang),
    'A gloss that follows the convention is correct: mark a gloss wrong only when it gives a wrong meaning, a form',
    `the convention does not ask for, a literal mistranslation, or is not ${own}.`,
    '',
    'Answer every question for every phrase, by number, with one of the allowed values. When a line is wrong or',
    'awkward, give the corrected line in `fix`. Answer with JSON matching the schema and nothing else.',
  ].join('\n')
}

export function buildJudgeTranslateRequest(
  slot: Slot,
  inputs: readonly JudgeTranslateInput[],
  lang: InterfaceLang,
  model: string,
): BuiltRequest {
  const own = LANGUAGE_NAMES[INTERFACE_LANGS[lang]]
  const { brief } = slot
  const blocks = [
    block('The set', [
      `${inputs.length} ${LANGUAGE_NAMES[slot.course]} phrases at level ${slot.level}, each with its ${own} line and glosses.`,
      `Scene: ${brief.scene}`,
      `Speakers: ${brief.speakers.join(' and ')}. Register: ${brief.register}.`,
    ]),
    block(
      'Phrases',
      inputs.map((p, i) =>
        JSON.stringify({
          n: i + 1,
          target: p.target,
          english: p.english,
          line: p.translation,
          glosses: p.glosses.map((g) => `${g.w} (${g.english}) = ${g.gloss}`),
        }),
      ),
    ),
    block('Questions, for every phrase', [
      '- faithful: ok / loose / wrong — does the line mean what the target means?',
      `- natural: ok / awkward / wrong — is it what a ${own} speaker says?`,
      '- register: ok / off',
      `- glosses: ok / wrong, and \`bad_glosses\`: the words whose gloss is wrong`,
      '- fix: the corrected line when not ok, else empty; note: why, in one short sentence',
      `Return exactly ${inputs.length} verdicts, numbered 1 to ${inputs.length}.`,
    ]),
  ]
  const system = judgeTranslateSystemPrompt(slot.course, lang)
  const user = blocks.join('\n\n')
  const body = {
    system,
    user,
    schema: JUDGE_TRANSLATE_SCHEMA,
    model,
    promptVersion: JUDGE_TRANSLATE_PROMPT_VERSION,
    temperature: 0,
    seed: 112,
  }
  return {
    system,
    messages: [{ role: 'user', content: user }],
    schema: JUDGE_TRANSLATE_SCHEMA,
    temperature: 0,
    seed: 112,
    cacheKey: hashJson(body),
    promptVersion: JUDGE_TRANSLATE_PROMPT_VERSION,
    briefHash: hashJson(brief),
  }
}
