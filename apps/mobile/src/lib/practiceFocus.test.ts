import { describe, expect, it } from 'vitest'
import { makePhrase } from '@loro/core/testing'
import {
  destinationTarget,
  inferRefrainFocus,
  parseRefrainFocus,
  refrainFocusIds,
  refrainResumeTarget,
  refrainSessionMatchesFocus,
  refrainSkipsWaveLock,
  sessionCoversDaySet,
  streamWaveMembers,
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
    expect(refrainFocusIds(focus, [makePhrase('cafe', { learned: true })], ['other'])).toEqual([
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

  it('keeps a live session whose members still match the requested focus', () => {
    expect(refrainSessionMatchesFocus(['a', 'b', 'a'], ['b', 'a'])).toBe(true)
    expect(refrainSessionMatchesFocus(['a'], ['a', 'b'])).toBe(false)
    expect(refrainSessionMatchesFocus(['a', 'b'], ['a'])).toBe(false)
    expect(refrainSessionMatchesFocus(['a'], undefined)).toBe(false)
  })

  it('sends the menu destination to the hard-phrase drill', () => {
    expect(destinationTarget('/practice/refrain')).toEqual({
      pathname: '/practice/refrain',
      params: { filter: 'hard' },
    })
    expect(destinationTarget('/practice/stream')).toBe('/practice/stream')
  })

  it('treats a session as covering the day only when its members are the frozen set', () => {
    expect(sessionCoversDaySet(['a', 'b', 'a'], ['b', 'a'])).toBe(true)
    expect(sessionCoversDaySet(['a'], ['a', 'b'])).toBe(false)
    expect(sessionCoversDaySet(['a', 'b'], ['a'])).toBe(false)
  })

  it('resumes a one-phrase drill with the phrase param', () => {
    const phrases = [makePhrase('cafe'), makePhrase('other', { difficulty: 'hard' })]
    const focus = inferRefrainFocus(['cafe'], phrases, ['cafe', 'other'])
    expect(focus).toEqual({ kind: 'phrase', phraseId: 'cafe' })
    expect(refrainResumeTarget(focus, 'morning')).toEqual({
      pathname: '/practice/refrain',
      params: { phrase: 'cafe' },
    })
  })

  it('resumes a difficult-only drill with the hard filter', () => {
    const phrases = [
      makePhrase('hard', { difficulty: 'hard' }),
      makePhrase('also', { difficulty: 'hard' }),
      makePhrase('easy', { difficulty: 'easy' }),
    ]
    const focus = inferRefrainFocus(['also', 'hard'], phrases, ['easy', 'hard', 'also'])
    expect(focus).toEqual({ kind: 'hard' })
    expect(refrainResumeTarget(focus, 'midday')).toEqual({
      pathname: '/practice/refrain',
      params: { filter: 'hard' },
    })
  })

  it('resumes a full-set session as a timed wave', () => {
    const phrases = [makePhrase('a'), makePhrase('b')]
    const focus = inferRefrainFocus(['a', 'b'], phrases, ['a', 'b'])
    expect(focus).toEqual({ kind: 'wave' })
    expect(refrainResumeTarget(focus, 'evening')).toEqual({
      pathname: '/practice/refrain',
      params: { wave: 'evening' },
    })
  })

  it('resumes an all-difficult day set as a timed wave', () => {
    const phrases = [
      makePhrase('a', { difficulty: 'hard' }),
      makePhrase('b', { difficulty: 'hard' }),
    ]
    expect(inferRefrainFocus(['a', 'b'], phrases, ['a', 'b'])).toEqual({ kind: 'wave' })
  })
})

describe('streamWaveMembers', () => {
  it('keeps learned wave members so the heading pills can count them', () => {
    const easy = makePhrase('easy')
    const learned = makePhrase('done', { learned: true })
    const extra = makePhrase('extra')
    expect(streamWaveMembers([easy, learned, extra], ['done', 'easy']).map((p) => p.id)).toEqual([
      'done',
      'easy',
    ])
  })

  it('falls back to every phrase when the frozen set has no members', () => {
    const extra = makePhrase('extra')
    expect(streamWaveMembers([extra], ['missing']).map((p) => p.id)).toEqual(['extra'])
  })
})
