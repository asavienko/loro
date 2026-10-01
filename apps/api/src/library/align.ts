/**
 * The sung song heard back (plan 113): the words a transcriber heard, with when each was sung,
 * matched to the lyrics the song was given, line by line. Pure, so it can be tested on its own.
 *
 * The match is a global alignment of folded tokens (letters and digits, case and accents dropped):
 * a word of the transcript is paired with the lyric word it is, or nearly is (a spelling the
 * transcriber got a letter wrong), or stands alone as something the singer added or the lyric left
 * out. Each line then takes the transcript words paired with its own, and the added words sung
 * inside or right beside them. A line whose every word was heard, with nothing added, was sung as
 * written; otherwise the line shows the words that were sung and keeps the written line beside
 * them. A line none of whose words was heard takes the added words sung where it should have been,
 * if any; otherwise the singer skipped it, and it has no timing.
 */
import type { SongLine, SongSection } from './writers.js'

/** A word the transcriber heard, and when. */
export interface HeardWord {
  text: string
  startMs: number
  endMs: number
}

export interface HeardLine extends SongLine {
  startMs: number | null
  endMs: number | null
  /** The line as written, when the singer sang it differently; null when the same. */
  written: { text: string; meaning: string } | null
}

export interface HeardSection {
  name: SongSection['name']
  lines: HeardLine[]
}

export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const tokens = (text: string): string[] => fold(text).split(' ').filter(Boolean)

/** Edit distance, for near matches; the strings are short. */
function distance(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
    }
    previous = current
  }
  return previous[b.length] ?? 0
}

/** Whether a heard word is a lyric word: the same, or one letter off in a word of four or more. */
export function sameWord(heard: string, written: string): boolean {
  if (heard === written) return true
  if (heard.length < 4 || written.length < 4) return false
  return distance(heard, written) <= (written.length >= 8 ? 2 : 1)
}

const MATCH = 2
const GAP = -1
const MISMATCH = -2
/** A word sung this soon after (or before) a line's words is part of the line, not an ad-lib. */
const ATTACH_MS = 600

/**
 * Pairs transcript tokens with lyric tokens (Needleman–Wunsch): for each transcript token, the index
 * of the lyric token it sings, or null for a word the singer added.
 */
function pair(heard: string[], written: string[]): (number | null)[] {
  const n = heard.length
  const m = written.length
  // score[i][j]: the best alignment of heard[0..i) with written[0..j).
  const score = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (__, j) => (i === 0 ? j * GAP : j === 0 ? i * GAP : 0)),
  )
  const at = (i: number, j: number) => score[i]?.[j] ?? 0
  const matched = (i: number, j: number) => sameWord(heard[i - 1] ?? '', written[j - 1] ?? '')
  for (let i = 1; i <= n; i++) {
    const row = score[i] ?? []
    for (let j = 1; j <= m; j++) {
      const diagonal = at(i - 1, j - 1) + (matched(i, j) ? MATCH : MISMATCH)
      row[j] = Math.max(diagonal, at(i - 1, j) + GAP, at(i, j - 1) + GAP)
    }
  }
  const pairs: (number | null)[] = Array.from({ length: n }, () => null)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    const here = at(i, j)
    const same = matched(i, j)
    if (here === at(i - 1, j - 1) + (same ? MATCH : MISMATCH)) {
      if (same) pairs[i - 1] = j - 1
      i--
      j--
    } else if (here === at(i - 1, j) + GAP) i--
    else j--
  }
  return pairs
}

/**
 * The song's lines as they were sung, each timed where it was heard. `sections` are the lyrics the
 * song was given; `heard` the transcript's words in order.
 */
export function alignLyrics(sections: SongSection[], heard: HeardWord[]): HeardSection[] {
  const lines = sections.flatMap((section) => section.lines)
  // Each lyric token knows its line; each line knows how many tokens it has.
  const lineOf: number[] = []
  const written: string[] = []
  const tokenCount: number[] = []
  for (const [at, line] of lines.entries()) {
    const words = tokens(line.text)
    tokenCount.push(words.length)
    for (const word of words) {
      written.push(word)
      lineOf.push(at)
    }
  }
  const spoken = heard.filter((word) => tokens(word.text).length > 0)
  const pairs = pair(
    spoken.map((word) => tokens(word.text).join('')),
    written,
  )
  const startOf = (k: number) => spoken[k]?.startMs ?? 0
  const endOf = (k: number) => spoken[k]?.endMs ?? 0

  // The line each heard word belongs to: the paired word's line, once the added words are placed.
  const placed: (number | null)[] = pairs.map((p) => (p === null ? null : (lineOf[p] ?? null)))
  const heardAt = new Set(placed.filter((at) => at !== null))
  const lineBefore = (k: number): number | null => {
    for (let i = k - 1; i >= 0; i--) if (pairs[i] !== null) return placed[i] ?? null
    return null
  }
  const lineAfter = (k: number): number | null => {
    for (let i = k + 1; i < placed.length; i++) if (pairs[i] !== null) return placed[i] ?? null
    return null
  }
  // An added word between two heard words of one line belongs to that line.
  for (let k = 0; k < placed.length; k++) {
    if (placed[k] !== null) continue
    const before = lineBefore(k)
    if (before !== null && before === lineAfter(k)) placed[k] = before
  }
  // A run of added words between two lines goes to the first line between them that was not heard at
  // all: what the singer sang instead of it. With none, the words sung right after the line before
  // (or right before the line after) belong to it; the rest, an ad-lib in the pause, to none.
  let i = 0
  while (i < placed.length) {
    if (placed[i] !== null) {
      i++
      continue
    }
    let end = i
    while (end < placed.length && placed[end] === null) end++
    const before = i > 0 ? (placed[i - 1] ?? -1) : -1
    const after = end < placed.length ? (placed[end] ?? lines.length) : lines.length
    const unheard = lines.findIndex((_, at) => at > before && at < after && !heardAt.has(at))
    if (unheard !== -1) for (let k = i; k < end; k++) placed[k] = unheard
    else {
      if (before >= 0) {
        let previousEnd = endOf(i - 1)
        for (let k = i; k < end; k++) {
          if (startOf(k) - previousEnd > ATTACH_MS) break
          placed[k] = before
          previousEnd = endOf(k)
        }
      }
      if (after < lines.length) {
        let nextStart = startOf(end)
        for (let k = end - 1; k >= i && placed[k] === null; k--) {
          if (nextStart - endOf(k) > ATTACH_MS) break
          placed[k] = after
          nextStart = startOf(k)
        }
      }
    }
    i = end
  }

  // The heard words of each line: paired ones, and the added ones placed with it.
  const perLine = lines.map(() => ({ words: [] as HeardWord[], matched: 0, added: 0 }))
  for (const [k, at] of placed.entries()) {
    const line = at === null ? undefined : perLine[at]
    const word = spoken[k]
    if (!line || !word) continue
    line.words.push(word)
    if (pairs[k] === null) line.added++
    else line.matched++
  }

  let at = 0
  return sections.map((section) => ({
    name: section.name,
    lines: section.lines.map((line) => {
      const sung = perLine[at] ?? { words: [], matched: 0, added: 0 }
      const count = tokenCount[at] ?? 0
      at++
      if (sung.words.length === 0) return { ...line, startMs: null, endMs: null, written: null }
      const startMs = Math.min(...sung.words.map((w) => w.startMs))
      const endMs = Math.max(...sung.words.map((w) => w.endMs))
      if (sung.matched === count && sung.added === 0)
        return { ...line, startMs, endMs, written: null }
      return {
        ...line,
        text: sung.words.map((w) => w.text.trim()).join(' '),
        startMs,
        endMs,
        written: { text: line.text, meaning: line.meaning },
      }
    }),
  }))
}
