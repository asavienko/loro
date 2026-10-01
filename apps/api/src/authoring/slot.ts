/**
 * A slot is one set the syllabus asks for, with its brief: what to write about, which words to use
 * and avoid, what to mention and what not to (plan 112 §1). Slots live in
 * `packages/content/v2/plan/<code>/<level>/<topic>.json`, committed and hand-editable; the brief
 * is the whole of what the model is told about the set, because the model remembers nothing.
 */
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { V2Language } from '@loro/content/v2'

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]

/** Course codes: en-GB and en-US are different courses and must not share ids (ADR-0017). */
export const COURSE_CODES: Record<V2Language, string> = {
  'es-ES': 'es',
  'bg-BG': 'bg',
  'en-GB': 'en',
  'en-US': 'us',
  'ru-RU': 'ru',
  'pl-PL': 'pl',
  'cs-CZ': 'cs',
}
export const COURSE_BY_CODE: Record<string, V2Language> = Object.fromEntries(
  Object.entries(COURSE_CODES).map(([lang, code]) => [code, lang as V2Language]),
)

/** One breath (P3-01): words by level, and 110 characters for every level. */
export const MAX_WORDS: Record<Level, number> = { A1: 7, A2: 9, B1: 11, B2: 14, C1: 14, C2: 14 }
export const MAX_CHARS = 110

const Lemma = z.strictObject({
  lemma: z.string().min(1),
  /** The sense meant, in English, so the model does not pick another. */
  gloss: z.string().min(1),
  pos: z.enum([
    'noun',
    'verb',
    'adj',
    'adv',
    'prep',
    'pron',
    'det',
    'conj',
    'num',
    'interj',
    'phrase',
  ]),
})

const GrammarPoint = z.strictObject({
  id: z.string().regex(/^[a-z]{2}-[a-z0-9-]+$/),
  kind: z.enum(['tense', 'aspect', 'mood', 'case', 'construction', 'register', 'evidential']),
  rule: z.string().min(1),
  example: z.string().min(1),
  /** How many of the set's phrases must show it. */
  minPhrases: z.int().min(1),
})

export const BriefSchema = z.strictObject({
  /** A person edited this brief: the planner never rewrites it. */
  edited: z.boolean(),
  scene: z.string().min(1),
  speakers: z.array(z.string().min(1)).min(1),
  register: z.string().min(1),
  grammarFocus: z.array(GrammarPoint).min(1).max(3),
  functions: z.array(z.string().regex(/^[a-z-]+$/)).min(1),
  mustUse: z.array(Lemma).min(6).max(20),
  shouldUse: z.array(Lemma),
  avoid: z.strictObject({
    lemmas: z.array(z.string().min(1)),
    themes: z.array(z.string().min(1)),
    /** `siblings` resolves at run time to the accepted phrases of the same topic and level. */
    textKeys: z.literal('siblings'),
  }),
  mention: z.array(z.string().min(1)),
  doNotMention: z.array(z.string().min(1)),
  variety: z.string().nullable(),
  notesHints: z.array(z.string().min(1)),
})
export type Brief = z.infer<typeof BriefSchema>

export const SlotSchema = z.strictObject({
  setId: z.string().regex(/^set-[a-z]{2}-[abc][12]-[a-z0-9-]+$/, 'set-<code>-<level>-<situation>'),
  course: z.enum(['es-ES', 'bg-BG', 'en-GB', 'en-US', 'ru-RU', 'pl-PL', 'cs-CZ']),
  level: z.enum(LEVELS),
  topic: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  situation: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  count: z.int().min(4).max(20),
  song: z.boolean(),
  brief: BriefSchema,
})
export type Slot = z.infer<typeof SlotSchema>

export const PlanFileSchema = z.strictObject({
  /** The plan file's own version, bumped when its shape changes. */
  version: z.literal(1),
  slots: z.array(SlotSchema).min(1),
})

export function loadPlanFile(path: string): Slot[] {
  const parsed = PlanFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  const seen = new Set<string>()
  for (const slot of parsed.slots) {
    if (seen.has(slot.setId)) throw new Error(`${path}: slot ${slot.setId} appears twice`)
    seen.add(slot.setId)
    const code = COURSE_CODES[slot.course]
    const expected = `set-${code}-${slot.level.toLowerCase()}-`
    if (!slot.setId.startsWith(expected)) {
      throw new Error(`${path}: ${slot.setId} should start with ${expected}`)
    }
  }
  return parsed.slots
}
