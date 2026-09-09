/** Read selected file bytes without building an unbounded buffer from a provider URI. */
interface ByteReader {
  read: () => Promise<{ readonly done: true } | { readonly done: false; readonly value: Uint8Array }>
  cancel: () => Promise<void>
  releaseLock: () => void
}

export async function readBoundedImportFile(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | null> {
  // Expo's stream declaration loses the non-terminal read result, while its runtime conforms to
  // the standard reader contract. Keep the narrow boundary here rather than using an unbounded
  // convenience read on the provider file.
  const reader = stream.getReader() as unknown as ByteReader
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
