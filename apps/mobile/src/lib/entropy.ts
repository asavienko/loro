/** Web and Node expose WebCrypto. Insecure contexts fail instead of minting colliding IDs. */
export function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length))
}
