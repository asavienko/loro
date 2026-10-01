/**
 * The judge's policy (plan 112 §3): a phrase a native speaker would call wrong, one that breaks
 * the brief's "do not mention", or a duplicate, is rejected on its own; two other failures reject; one failure, or an awkward or loose answer, sends
 * the phrase to review. A learner must never be handed a wrong sentence with a flag on it. Verdicts on written phrases go to
 * `packages/content/v2/reviews/<code>.jsonl` with the reviewer `judge:<model>`, next to where the
 * native verdicts will go, keyed by a hash of what was judged so an edit makes them stale.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CONTENT_ROOT } from './context.js'
import { hashJson } from './hash.js'
import type { JudgeInput, RawJudgeAnswer, RawVerdict } from './prompt/judge.js'
import type {
  JudgeTranslateInput,
  RawJudgeTranslateAnswer,
  RawTranslateVerdict,
} from './prompt/judge-translate.js'

export type Outcome = 'ok' | 'review' | 'reject'

export interface Verdict {
  /** Position in the judged list, 0-based. */
  index: number
  outcome: Outcome
  /** The questions answered against the phrase. */
  failures: string[]
  /** Answers that are not failures but worth a human look. */
  minors: string[]
  fix: string
  note: string
}

export function failuresOf(v: RawVerdict): {
  failures: string[]
  minors: string[]
  critical: boolean
} {
  const failures: string[] = []
  const minors: string[] = []
  let critical = false
  if (v.natural === 'wrong') {
    failures.push('natural: wrong')
    critical = true
  }
  if (v.natural === 'awkward') minors.push('natural: awkward')
  if (v.english === 'wrong') failures.push('english: wrong')
  if (v.english === 'loose') minors.push('english: loose')
  if (v.level === 'too_hard') failures.push('level: too hard')
  if (v.grammar_claim === 'wrong') failures.push('grammar claim: wrong')
  if (v.glosses === 'wrong') failures.push('glosses: wrong')
  if (v.brief === 'violates') {
    failures.push('brief: violated')
    critical = true
  }
  if (v.duplicate_of > 0) {
    failures.push(`duplicate of ${v.duplicate_of}`)
    critical = true
  }
  return { failures, minors, critical }
}

/**
 * One verdict per input, in input order. A missing or doubled number counts as a failure of the
 * judge, not of the phrase: the phrase is sent to review with a note, never rejected on no answer.
 */
export function applyVerdicts(answer: RawJudgeAnswer, inputs: readonly JudgeInput[]): Verdict[] {
  const byN = new Map<number, RawVerdict>()
  for (const v of answer.verdicts) if (!byN.has(v.n)) byN.set(v.n, v)
  return inputs.map((_, index) => {
    const raw = byN.get(index + 1)
    if (!raw) {
      return {
        index,
        outcome: 'review',
        failures: [],
        minors: ['the judge gave no verdict'],
        fix: '',
        note: 'no verdict',
      }
    }
    const { failures, minors, critical } = failuresOf(raw)
    const outcome: Outcome =
      critical || failures.length >= 2
        ? 'reject'
        : failures.length === 1 || minors.length > 0
          ? 'review'
          : 'ok'
    return { index, outcome, failures, minors, fix: raw.fix.trim(), note: raw.note.trim() }
  })
}

export function summarize(verdicts: readonly Verdict[]): string {
  const count = (o: Outcome) => verdicts.filter((v) => v.outcome === o).length
  return `${count('ok')} ok, ${count('review')} review, ${count('reject')} reject`
}

/** A review row (plan 112 §9); the judge's rows and the native reviewers' share the file. */
export interface ReviewRow {
  phraseId: string
  lang: string
  contentHash: string
  reviewer: string
  date: string
  verdict: Outcome
  fields: string[]
  comment: string
  fix: string
}

export function reviewsPath(code: string): string {
  return join(CONTENT_ROOT, 'reviews', `${code}.jsonl`)
}

export function contentHashOf(input: JudgeInput): string {
  return hashJson({ target: input.target, english: input.english, words: input.words }).slice(0, 16)
}

export function readReviews(code: string): ReviewRow[] {
  const path = reviewsPath(code)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as ReviewRow)
}

/** Appends rows not yet present (same phrase, content and reviewer); returns how many were added. */
export function appendReviews(code: string, rows: readonly ReviewRow[]): number {
  const existing = new Set(
    readReviews(code).map((r) => `${r.phraseId}|${r.contentHash}|${r.reviewer}`),
  )
  const fresh = rows.filter((r) => !existing.has(`${r.phraseId}|${r.contentHash}|${r.reviewer}`))
  if (fresh.length === 0) return 0
  const path = reviewsPath(code)
  mkdirSync(dirname(path), { recursive: true })
  const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, `${before}${fresh.map((r) => JSON.stringify(r)).join('\n')}\n`)
  return fresh.length
}

/**
 * The translate judge's policy: a line that is wrong or unfaithful is rejected (a repair call is
 * cheap, and the learner hears the line); a gloss the judge calls wrong, or a loose, awkward or
 * off-register line, goes to review, because the spike showed the judge rejecting glosses that
 * follow the convention to the letter, and a gloss is a tap-to-see aid the native sample checks.
 * Two failures still reject.
 */
export function translateFailuresOf(v: RawTranslateVerdict): {
  failures: string[]
  minors: string[]
  critical: boolean
} {
  const failures: string[] = []
  const minors: string[] = []
  let critical = false
  if (v.faithful === 'wrong') {
    failures.push('faithful: wrong')
    critical = true
  }
  if (v.faithful === 'loose') minors.push('faithful: loose')
  if (v.natural === 'wrong') {
    failures.push('natural: wrong')
    critical = true
  }
  if (v.natural === 'awkward') minors.push('natural: awkward')
  if (v.register === 'off') minors.push('register: off')
  if (v.glosses === 'wrong' || v.bad_glosses.length > 0) {
    failures.push(`glosses: wrong (${v.bad_glosses.join(', ') || 'unspecified'})`)
  }
  return { failures, minors, critical }
}

export function applyTranslateVerdicts(
  answer: RawJudgeTranslateAnswer,
  inputs: readonly JudgeTranslateInput[],
): Verdict[] {
  const byN = new Map<number, RawTranslateVerdict>()
  for (const v of answer.verdicts) if (!byN.has(v.n)) byN.set(v.n, v)
  return inputs.map((_, index) => {
    const raw = byN.get(index + 1)
    if (!raw) {
      return {
        index,
        outcome: 'review',
        failures: [],
        minors: ['the judge gave no verdict'],
        fix: '',
        note: 'no verdict',
      }
    }
    const { failures, minors, critical } = translateFailuresOf(raw)
    const outcome: Outcome =
      critical || failures.length >= 2
        ? 'reject'
        : failures.length === 1 || minors.length > 0
          ? 'review'
          : 'ok'
    return { index, outcome, failures, minors, fix: raw.fix.trim(), note: raw.note.trim() }
  })
}

export function translateContentHash(input: JudgeTranslateInput): string {
  return hashJson({
    translation: input.translation,
    glosses: input.glosses.map((g) => g.gloss),
  }).slice(0, 16)
}
