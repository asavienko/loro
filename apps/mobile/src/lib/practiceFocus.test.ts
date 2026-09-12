import { describe, expect, it } from 'vitest'
import { makePhrase } from '@loro/core/testing'
import {
  destinationTarget,
  parseRefrainFocus,
  refrainFocusIds,
  refrainSkipsWaveLock,
  streamWaveQueue,
} from './practiceFocus'

describe('streamWaveQueue', () => {
  it('lists the frozen wave in rank order and ignores learned members', () => {
    const easy = makePhrase('easy', { difficulty: 'easy', plays: 5 })
    const hard = makePhrase('hard', { difficulty: 'hard', plays: 5 })
    const learned = makePhrase('done', { learned: true, plays: 0 })
    const extra = makePhrase('extra', { difficulty: 'med', plays: 0 })
    const rank = (phrase: { id: string }) => (phrase.id === 'hard' ? 0 : 1)
    expect(
      streamWaveQueue([easy, hard, learned, extra], ['done', 'hard', 'easy'], rank).map(
        (p) => p.id,
      ),
    ).toEqual(['hard', 'easy'])
  })

  it('falls back to every active phrase when the wave has no live members', () => {
    const extra = makePhrase('extra')
    const learned = makePhrase('done', { learned: true })
    expect(streamWaveQueue([extra, learned], ['done'], () => 0).map((p) => p.id)).toEqual(['extra'])
  })
})

describe('refrain focus', () => {
  it('treats a phrase param as a single-phrase drill and skips the wave lock', () => {
    const focus = parseRefrainFocus({ phrase: 'cafe' })
    expect(focus).toEqual({ kind: 'phrase', phraseId: 'cafe' })
    expect(refrainSkipsWaveLock(focus)).toBe(true)
    expect(refrainFocusIds(focus, [makePhrase('cafe'), makePhrase('other')], ['other'])).toEqual([
      'cafe',
    ])
  })

  it('filters the menu entry to active difficult phrases only', () => {
    const focus = parseRefrainFocus({ filter: 'hard' })
    const phrases = [
      makePhrase('hard', { difficulty: 'hard' }),
      makePhrase('easy', { difficulty: 'easy' }),
      makePhrase('retired', { difficulty: 'hard', learned: true }),
    ]
    expect(refrainFocusIds(focus, phrases, ['easy'])).toEqual(['hard'])
    expect(refrainSkipsWaveLock(focus)).toBe(true)
  })

  it('keeps timed-wave entry on the frozen set', () => {
    const focus = parseRefrainFocus({ wave: 'morning' })
    expect(focus).toEqual({ kind: 'wave' })
    expect(refrainSkipsWaveLock(focus)).toBe(false)
    expect(refrainFocusIds(focus, [makePhrase('a'), makePhrase('b')], ['b', 'missing'])).toEqual([
      'b',
    ])
  })

  it('treats a bare Refrain URL as the difficult-phrase drill', () => {
    const focus = parseRefrainFocus({})
    expect(focus).toEqual({ kind: 'hard' })
    expect(refrainSkipsWaveLock(focus)).toBe(true)
  })

  it('sends the menu destination to the hard-phrase drill', () => {
    expect(destinationTarget('/practice/refrain')).toEqual({
      pathname: '/practice/refrain',
      params: { filter: 'hard' },
    })
    expect(destinationTarget('/practice/stream')).toBe('/practice/stream')
  })
})
