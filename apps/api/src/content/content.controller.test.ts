import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { LoroError } from '../common/errors.js'
import { ContentController } from './content.controller.js'

describe('ContentController pack responses', () => {
  const controller = new ContentController()

  it('preserves the exact catalog order and response bytes', () => {
    const body = JSON.stringify(controller.pack('cafe'))

    // Keep the wire contract exact without embedding the four full phrase records in
    // this focused test. A reordered phrase or response key changes the digest.
    expect(body).toHaveLength(764)
    expect(createHash('sha256').update(body).digest('hex')).toBe(
      '2ca88735efb859717d24da37593db654a88d66cb386503ce52a0a9f6d708abf2',
    )
  })

  it('preserves the unknown-pack error contract', () => {
    expect(() => controller.pack('missing')).toThrow(
      expect.objectContaining<Partial<LoroError>>({
        code: 'VALIDATION_FAILED',
        message: "unknown pack 'missing'",
        status: 422,
      }),
    )
  })
})
