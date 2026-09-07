import { OAuthProvidersSchema, type OAuthProvider } from '@loro/core/api/oauth'
import { Platform } from 'react-native'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { AccountClient } from './client'

const configuredUrl: unknown = process.env.EXPO_PUBLIC_API_URL
const api = typeof configuredUrl === 'string' ? configuredUrl.replace(/\/$/, '') : undefined
const key = 'loro.auth.refresh.v1'
export const authConfigured = Boolean(api?.startsWith('https://'))
export async function authRequest(path: string, body?: unknown): Promise<unknown> {
  if (!api || !authConfigured) throw new Error('Sign-in unavailable')
  const response = await fetch(`${api}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
    credentials: 'omit',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Account request failed')
  return response.status === 204 ? null : response.json()
}
const base64url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const random = (): string => {
  const bytes = Crypto.getRandomBytes(32)
  // Base64 without Node's Buffer; supported by Hermes and browsers.
  return base64url(btoa(String.fromCharCode(...bytes)))
}
export const accountClient = new AccountClient({
  request: authRequest,
  read: () => (Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(key)),
  write: async (token) => {
    if (Platform.OS === 'web') return
    if (token)
      await SecureStore.setItemAsync(key, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      })
    else await SecureStore.deleteItemAsync(key)
  },
  random,
  challenge: async (verifier) =>
    base64url(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
        encoding: Crypto.CryptoEncoding.BASE64,
      }),
    ),
  redirect:
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/account`
      : 'loro://account',
  authorize: async (url, redirect) => {
    const result = await WebBrowser.openAuthSessionAsync(url, redirect, {
      windowName: 'loro-sign-in',
    })
    return result.type === 'success' ? result.url : null
  },
})
/** Popup callback has the same origin as the opener. Expo validates the pending browser state. */
export function completeBrowserSignIn(): void {
  if (Platform.OS === 'web') WebBrowser.maybeCompleteAuthSession()
}

/** Open synchronously on the click so slow start requests cannot trigger popup blocking. */
export function beginSignIn(provider: OAuthProvider) {
  const popup =
    Platform.OS === 'web'
      ? window.open('about:blank', 'loro-sign-in', 'popup,width=500,height=700')
      : null
  if (Platform.OS === 'web' && !popup) return Promise.reject(new Error('Popup blocked'))
  return accountClient.signIn(provider).finally(() => {
    popup?.close()
  })
}

export async function availableProviders(): Promise<OAuthProvider[]> {
  return OAuthProvidersSchema.parse(await authRequest('/auth/providers')).providers
}
