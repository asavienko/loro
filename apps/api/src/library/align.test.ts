/** Plan 113: the words a transcriber heard, matched to the song's lines. */
import { describe, expect, it } from 'vitest'
import { alignLyrics, fold, sameWord, type HeardWord } from './align.js'
import type { SongSection } from './writers.js'

/** Heard words from a text, each 300 ms long with 100 ms between; a "|" is a pause of 1.5 s. */
function heard(text: string): HeardWord[] {
  const words: HeardWord[] = []
  let at = 0
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word === '|') {
      at += 1500
      continue
    }
    words.push({ text: word, startMs: at, endMs: at + 300 })
    at += 400
  }
  return words
}

const sections: SongSection[] = [
  {
    name: 'verse',
    lines: [
      { text: '¿Tienen habitaciones libres?', meaning: 'Any rooms free?', phraseId: 'p-1' },
      { text: 'La llave, por favor', meaning: 'The key, please', phraseId: 'p-2' },
    ],
  },
  {
    name: 'chorus',
    lines: [
      { text: '¿Tienen habitaciones libres?', meaning: 'Any rooms free?', phraseId: 'p-1' },
      { text: 'Buenas noches', meaning: 'Good night', phraseId: null },
    ],
  },
]

describe('alignLyrics', () => {
  it('times every line as written when the song was sung as written', () => {
    const words = heard(
      'Tienen habitaciones libres | la llave por favor | tienen habitaciones libres | buenas noches',
    )
    const lines = alignLyrics(sections, words).flatMap((s) => s.lines)
    expect(lines.map((l) => l.written)).toEqual([null, null, null, null])
    expect(lines.map((l) => l.text)).toEqual(sections.flatMap((s) => s.lines.map((l) => l.text)))
    expect(lines.map((l) => [l.startMs, l.endMs])).toEqual([
      [0, 1100],
      [2700, 4200],
      [5800, 6900],
      [8500, 9200],
    ])
  })

  it('shows what the singer sang when a line differs, and keeps the written line beside it', () => {
    const words = heard(
      'Tienen habitaciones libres | la llave por favor | tienen habitaciones libres | muy buenas noches amor',
    )
    const lines = alignLyrics(sections, words).flatMap((s) => s.lines)
    expect(lines[3]).toMatchObject({
      text: 'muy buenas noches amor',
      written: { text: 'Buenas noches', meaning: 'Good night' },
      startMs: 8500,
      endMs: 10_000,
    })
    expect(lines.slice(0, 3).every((l) => l.written === null)).toBe(true)
    // A word sung in the middle of a line belongs to it too.
    const inside = alignLyrics(
      sections,
      heard('Tienen habitaciones libres | la llave ya por favor'),
    ).flatMap((s) => s.lines)
    expect(inside[1]).toMatchObject({
      text: 'la llave ya por favor',
      written: { text: 'La llave, por favor' },
    })
  })

  it('gives a line the singer skipped no timing, and a line sung with other words those words', () => {
    // The second line is skipped; the fourth is sung as something else entirely.
    const words = heard('Tienen habitaciones libres | tienen habitaciones libres | hasta mañana')
    const lines = alignLyrics(sections, words).flatMap((s) => s.lines)
    expect(lines[1]).toMatchObject({
      text: 'La llave, por favor',
      startMs: null,
      endMs: null,
      written: null,
    })
    expect(lines[3]).toMatchObject({ text: 'hasta mañana', written: { text: 'Buenas noches' } })
    expect(lines[3]?.startMs).toBe(5400)
  })

  it('forgives a transcriber a letter, and ignores an ad-lib in a pause between lines', () => {
    const words = heard(
      'oh oh | Tienen habitasiones libres | la llave por favor | yeah | tienen habitaciones libres | buenas noches',
    )
    const lines = alignLyrics(sections, words).flatMap((s) => s.lines)
    // "habitasiones" is habitaciones; "oh oh" before the song and "yeah" between lines belong to none.
    expect(lines.map((l) => l.written)).toEqual([null, null, null, null])
    expect(lines[0]?.startMs).toBe(2300)
    expect(lines[1]?.endMs).toBe(6500)
    expect(lines[2]?.startMs).toBe(10_000)
  })

  it('keeps a line untimed when nothing at all was heard', () => {
    const lines = alignLyrics(sections, []).flatMap((s) => s.lines)
    expect(lines.every((l) => l.startMs === null && l.written === null)).toBe(true)
  })

  it('folds case, accents and punctuation, and matches near words only when long enough', () => {
    expect(fold('¿Tienen habitaciones LIBRES?')).toBe('tienen habitaciones libres')
    expect(sameWord('habitasiones', 'habitaciones')).toBe(true)
    expect(sameWord('la', 'le')).toBe(false)
    expect(sameWord('noche', 'noches')).toBe(true)
  })
})
