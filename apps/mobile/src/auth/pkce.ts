import { randomBytes } from '../lib/entropy'

const base64url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function encodeBase64Url(bytes: Uint8Array): string {
  return base64url(btoa(String.fromCharCode(...bytes)))
}

/** PKCE S256 challenge: base64url(SHA-256(verifier)). Matches the API `hash()`. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return encodeBase64Url(new Uint8Array(digest))
}

export function randomVerifier(): string {
  return encodeBase64Url(randomBytes(32))
}

export function randomPopupName(): string {
  return `loro-sign-in-${encodeBase64Url(randomBytes(12))}`
}
