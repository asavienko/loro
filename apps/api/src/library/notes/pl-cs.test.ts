/**
 * Polish and Czech notes by spelling (pl.ts, cs.ts). The rules were written by AI and await native
 * review (Q-23); these tests only prove the lists work as lists.
 */
import { describe, expect, it } from 'vitest'
import { CZECH_GRAMMAR, CZECH_SOUND_TIPS } from './cs.js'
import type { GrammarRule } from './grammar.js'
import { POLISH_GRAMMAR, POLISH_SOUND_TIPS } from './pl.js'

const pick = (rules: { id: string; find: (t: string) => string | null }[], text: string) =>
  rules.find((r) => r.find(text) !== null)?.id

const POLISH = { POLISH_GRAMMAR, POLISH_SOUND_TIPS }
const CZECH = { CZECH_GRAMMAR, CZECH_SOUND_TIPS }
const LISTS = { ...POLISH, ...CZECH }

describe('Polish notes by spelling', () => {
  it('choose a rule from the phrase’s words', () => {
    expect(pick(POLISH_GRAMMAR, 'Poproszę kawę')).toBe('poproszę')
    expect(pick(POLISH_GRAMMAR, 'Czy pan ma bilet?')).toBe('pan-pani')
    expect(pick(POLISH_GRAMMAR, 'Nie ma kawy')).toBe('nie-ma')
    expect(pick(POLISH_GRAMMAR, 'Jak się masz?')).toBe('how-are-you')
    expect(pick(POLISH_GRAMMAR, 'Kawa')).toBe('cases')
  })

  it('choose a sound from the spelling', () => {
    expect(pick(POLISH_SOUND_TIPS, 'Dziękuję')).toBe('nasal')
    expect(pick(POLISH_SOUND_TIPS, 'Dobrze')).toBe('rz-zh')
    expect(pick(POLISH_SOUND_TIPS, 'Mały')).toBe('l-stroke')
    expect(pick(POLISH_SOUND_TIPS, 'Tak')).toBe('stress')
  })
})

describe('Czech notes by spelling', () => {
  it('choose a rule from the phrase’s words', () => {
    expect(pick(CZECH_GRAMMAR, 'Prosím')).toBe('prosim')
    expect(pick(CZECH_GRAMMAR, 'Dám si kávu')).toBe('dam-si')
    expect(pick(CZECH_GRAMMAR, 'Nemám čas')).toBe('negation')
    expect(pick(CZECH_GRAMMAR, 'Dobrý den')).toBe('greetings')
    expect(pick(CZECH_GRAMMAR, 'Káva')).toBe('cases')
  })

  it('choose a sound from the spelling', () => {
    expect(pick(CZECH_SOUND_TIPS, 'Řeka')).toBe('r-hacek')
    expect(pick(CZECH_SOUND_TIPS, 'Děkuji')).toBe('e-hacek')
    expect(pick(CZECH_SOUND_TIPS, 'Ano')).toBe('stress')
  })
})

describe('every list', () => {
  it('ends in a rule that applies to any phrase', () => {
    for (const [name, rules] of Object.entries(LISTS)) {
      const last = rules[rules.length - 1]
      for (const text of ['Ahoj', '123', 'xyz qq', 'Dzień dobry!']) {
        expect(last?.find(text), `${name} ${text}`).not.toBeNull()
      }
    }
  })

  it('has unique ids and speaks en, bg, ru and the other new language, never its own', () => {
    for (const [name, rules] of Object.entries(LISTS)) {
      expect(new Set(rules.map((r) => r.id)).size, name).toBe(rules.length)
      const other = name.startsWith('POLISH') ? 'cs' : 'pl'
      const own = name.startsWith('POLISH') ? 'pl' : 'cs'
      for (const rule of rules) {
        expect(Object.keys(rule.say).sort(), `${name} ${rule.id}`).toEqual(
          ['bg', 'en', other, 'ru'].sort(),
        )
        expect(Object.keys(rule.say)).not.toContain(own)
      }
    }
  })

  it('keeps every note within a note’s length', () => {
    for (const [name, rules] of Object.entries(LISTS) as [
      string,
      (GrammarRule | { id: string; say: GrammarRule['say'] })[],
    ][]) {
      for (const rule of rules) {
        for (const [locale, say] of Object.entries(rule.say)) {
          const note = say('wwwwwwwwww')
          const where = `${name} ${rule.id} ${locale}`
          expect(note.title.length, where).toBeLessThanOrEqual(60)
          expect(note.text.length, where).toBeLessThanOrEqual(name.endsWith('TIPS') ? 225 : 300)
        }
      }
    }
  })
})
