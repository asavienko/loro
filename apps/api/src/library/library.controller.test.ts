/** AI-05: a deck Claude is still writing reaches the app as 202, inside the gateway's ceiling. */
import type { Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedRequest } from '../auth/auth.guard.js'
import { LibraryWriteController } from './library.controller.js'
import { DECK_WAIT_MS, type LibraryService } from './library.service.js'

function respond() {
  const res = { status: vi.fn(), setHeader: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}
const learner = { principal: { userId: 'u-1' } } as unknown as AuthenticatedRequest

describe('POST /library/generate/phrases', () => {
  it('answers 202 with Retry-After while the deck is being written, waiting less than the gateway', async () => {
    const generatePhrases = vi.fn().mockResolvedValue({ status: 'writing' })
    const controller = new LibraryWriteController({ generatePhrases } as unknown as LibraryService)
    const res = respond()
    const body = { mode: 'topic', input: 'hotel' }
    expect(await controller.generatePhrases(learner, body, res as unknown as Response)).toEqual({
      status: 'writing',
    })
    expect(generatePhrases).toHaveBeenCalledWith('u-1', body, DECK_WAIT_MS)
    expect(DECK_WAIT_MS).toBeLessThan(28_000)
    expect(res.status).toHaveBeenCalledWith(202)
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1')
  })

  it('answers the deck itself as it is', async () => {
    const deck = { provider: 'claude', phrases: [], themes: [] }
    const controller = new LibraryWriteController({
      generatePhrases: vi.fn().mockResolvedValue(deck),
    } as unknown as LibraryService)
    const res = respond()
    expect(await controller.generatePhrases(learner, {}, res as unknown as Response)).toBe(deck)
    expect(res.status).not.toHaveBeenCalled()
  })
})
