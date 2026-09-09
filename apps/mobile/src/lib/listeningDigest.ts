import { normalizeListeningText } from '@loro/core'

export async function digestListeningText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeListeningText(text))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
