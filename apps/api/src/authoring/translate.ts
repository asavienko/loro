/**
 * The `translate` stage's checks and file (plan 112 §2–3, ADR-0017): one answer is aligned with the
 * set's phrases by number and each phrase's glosses with its words by position; anything that does
 * not line up is a problem for that phrase, named. Accepted lines go to
 * `v2/courses/<code>/<level>/<topic>.<lang>.jsonl`, the only file this stage writes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CONTENT_ROOT } from './context.js'
import {
  INTERFACE_LANGS,
  type InterfaceLang,
  type RawTranslateAnswer,
  type TranslateInput,
} from './prompt/translate.js'
import { COURSE_CODES, type Slot } from './slot.js'

export type LocaleLine =
  | { kind: 'set'; id: string; subtitle: string }
  | { kind: 'phrase'; id: string; translation: string; words: Record<string, string> }

export function localeShardPath(slot: Slot, lang: InterfaceLang): string {
  return join(
    CONTENT_ROOT,
    'courses',
    COURSE_CODES[slot.course],
    slot.level,
    `${slot.topic}.${lang}.jsonl`,
  )
}

export function readLocaleShard(path: string): LocaleLine[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as LocaleLine)
}

/** Whether the set is already in this language's file. */
export function isTranslated(slot: Slot, lang: InterfaceLang): boolean {
  return readLocaleShard(localeShardPath(slot, lang)).some(
    (l) => l.kind === 'set' && l.id === slot.setId,
  )
}

/** Appends; never rewrites a line (ADR-0017). */
export function appendLocaleShard(
  slot: Slot,
  lang: InterfaceLang,
  lines: readonly LocaleLine[],
): void {
  const path = localeShardPath(slot, lang)
  if (isTranslated(slot, lang)) throw new Error(`${slot.setId} is already in ${path}`)
  mkdirSync(dirname(path), { recursive: true })
  const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, `${before}${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
}

const LETTERS: Record<InterfaceLang, RegExp> = {
  bg: /\p{Script=Cyrillic}/gu,
  ru: /\p{Script=Cyrillic}/gu,
  pl: /\p{Script=Latin}/gu,
  cs: /\p{Script=Latin}/gu,
}

/**
 * Whether the text is written in the language's script: most of its letters, not all, since a
 * Russian line may keep «wifi» or a dish's name as it is.
 */
/** A gloss that simply keeps the word («wifi», «croissant») is a loan, not an English gloss. */
function isLoan(gloss: string, word: string): boolean {
  return (
    gloss.toLowerCase().replace(/[^\p{L}]/gu, '') === word.toLowerCase().replace(/[^\p{L}]/gu, '')
  )
}

export function inScript(text: string, lang: InterfaceLang): boolean {
  const letters = (text.match(/\p{L}/gu) ?? []).length
  if (letters === 0) return false
  const own = (text.match(LETTERS[lang]) ?? []).length
  // Three fifths: «У вас есть wifi?» is 8 Cyrillic letters to 4 Latin.
  return own / letters >= 0.6
}

export interface TranslatedPhrase {
  id: string
  translation: string
  words: Record<string, string>
  problems: string[]
}

export function checkTranslation(
  answer: RawTranslateAnswer,
  inputs: readonly TranslateInput[],
  lang: InterfaceLang,
): { subtitle: string; phrases: TranslatedPhrase[] } {
  const byN = new Map<number, RawTranslateAnswer['phrases'][number]>()
  for (const p of answer.phrases) if (!byN.has(p.n)) byN.set(p.n, p)
  const phrases = inputs.map((input, index): TranslatedPhrase => {
    const raw = byN.get(index + 1)
    const problems: string[] = []
    if (!raw) return { id: input.id, translation: '', words: {}, problems: ['no answer'] }
    const translation = raw.translation.trim()
    if (translation.length === 0) problems.push('empty translation')
    else if (!inScript(translation, lang))
      problems.push(`not in the ${INTERFACE_LANGS[lang]} script`)
    if (translation.length > 2 * Math.max(input.english.length, 20) + 20)
      problems.push('far longer than the English')
    if (raw.glosses.length !== input.words.length) {
      problems.push(`${raw.glosses.length} glosses for ${input.words.length} words`)
    }
    const words: Record<string, string> = {}
    input.words.forEach((w, i) => {
      const gloss = (raw.glosses[i] ?? '').trim()
      if (gloss.length === 0) problems.push(`empty gloss for «${w.w}»`)
      else if (!inScript(gloss, lang) && !isLoan(gloss, w.w))
        problems.push(`gloss for «${w.w}» not in the ${INTERFACE_LANGS[lang]} script: «${gloss}»`)
      words[w.w.toLowerCase()] = gloss
    })
    return { id: input.id, translation, words, problems }
  })
  return { subtitle: answer.subtitle.trim(), phrases }
}
