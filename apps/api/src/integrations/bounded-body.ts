/**
 * A provider response read whole but never past a byte limit: the stream is cancelled the moment it
 * grows too large, and the text must be valid UTF-8 JSON. Any failure is the caller's `fail()`.
 */
export async function boundedJson(
  response: Response,
  limit: number,
  fail: () => Error,
): Promise<unknown> {
  if (!response.body) throw fail()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      const bytes: unknown = chunk.value
      if (!(bytes instanceof Uint8Array)) throw fail()
      size += bytes.byteLength
      if (size > limit) {
        await reader.cancel()
        throw fail()
      }
      chunks.push(bytes)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    ) as unknown
  } catch {
    throw fail()
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
