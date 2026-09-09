import { describe, expect, it } from 'vitest'
import { readBoundedImportFile } from './readBoundedImportFile'

function stream(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk))
      controller.close()
    },
  })
}

describe('bounded import reader', () => {
  it('returns a bounded file intact', async () => {
    await expect(
      readBoundedImportFile(stream([new Uint8Array([1, 2]), new Uint8Array([3])]), 3),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it('cancels immediately after crossing the byte budget', async () => {
    await expect(
      readBoundedImportFile(stream([new Uint8Array([1, 2]), new Uint8Array([3, 4])]), 3),
    ).resolves.toBeNull()
  })
})
