import { describe, expect, it } from 'vitest'
import { decodeCheckpoint, encodeCheckpoint, type CourseCheckpoint } from './checkpoint.js'
import { userPhraseId } from '../domain/ids.js'

const checkpoint: CourseCheckpoint = {
  version: 1,
  targetLocale: 'es-ES',
  localDay: '2026-09-07',
  revision: 1,
  streamCursor: 0,
  contentSignature: '[["one","hola"]]',
  refrainResume: {
    session: {
      sessionId: 's1',
      cursor: 0,
      plan: {
        engineId: 'refrain',
        closed: true,
        estimatedMs: 0,
        items: [
          {
            itemId: 'one#0',
            phraseId: userPhraseId('one'),
            mode: 'echo',
            prompt: { show: 'full' },
            gate: { kind: 'tap' },
            audio: null,
            meta: { repIndex: 0, repTarget: 6 },
          },
        ],
      },
    },
    cursor: 0,
    lastLatency: null,
    history: [],
    done: false,
  },
}

describe('checkpoint input boundary', () => {
  it('round trips the session content signature', () => {
    expect(decodeCheckpoint(encodeCheckpoint(checkpoint))).toEqual(checkpoint)
  })
  it.each([
    { mode: 'unsupported' },
    { meta: { repIndex: 1.5, repTarget: 6 } },
    { meta: { repIndex: 6, repTarget: 6 } },
    { meta: { repIndex: 0, repTarget: 0 } },
    { meta: { repIndex: 0, repTarget: 2001 } },
  ])('discards invalid Refrain item data: %j', (patch) => {
    const value = structuredClone(checkpoint)
    const item = value.refrainResume.session?.plan.items[0]
    Object.assign(item ?? {}, patch)
    expect(decodeCheckpoint(JSON.stringify(value))).toBeNull()
  })

  it.each(['2026-02-29', '2025-04-31', '2025-02-29'])(
    'discards a checkpoint with an impossible local day: %s',
    (localDay) => {
      const value = { ...checkpoint, localDay }
      expect(decodeCheckpoint(JSON.stringify(value))).toBeNull()
    },
  )

  it('discards a checkpoint whose displayed and engine cursors disagree', () => {
    const value = { ...checkpoint, refrainResume: { ...checkpoint.refrainResume, cursor: 1 } }
    expect(decodeCheckpoint(JSON.stringify(value))).toBeNull()
  })
})
