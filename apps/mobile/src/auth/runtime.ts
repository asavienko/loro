import { OAuthProvidersSchema, type OAuthProvider } from '@loro/core/api/oauth'
import { Platform } from 'react-native'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import type { AuthorizationPorts } from './client'
import { configuredNativeRedirectUri } from './redirect'
import { accountClient } from '../lib/account/runtime'
import { apiUrl as api, requestWithTimeout } from '../lib/backend'

const base64url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const authorizationPorts: AuthorizationPorts = {
  random: () => base64url(btoa(String.fromCharCode(...Crypto.getRandomBytes(32)))),
  challenge: async (verifier) =>
    base64url(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
        encoding: Crypto.CryptoEncoding.BASE64,
      }),
    ),
  redirect:
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/account`
      : configuredNativeRedirectUri(Constants.expoConfig?.extra?.nativeRedirectUri),
  authorize: async (url, redirect) => {
    const result = await WebBrowser.openAuthSessionAsync(url, redirect, {
      windowName: 'loro-sign-in',
    })
    return result.type === 'success' ? result.url : null
  },
}
/** Popup callback has the same origin as its opener; Expo validates pending browser state. */
export function completeBrowserSignIn(): void {
  if (Platform.OS !== 'web') return
  try {
    WebBrowser.maybeCompleteAuthSession()
  } catch {
    // Browser storage may be disabled. Root hydration must still reach its recovery UI;
    // a later provider request reports its own authorization error without a session.
  }
}
/** Open on the click before fetching OAuth start so browser popup policy permits sign-in. */
export function beginSignIn(provider: OAuthProvider): Promise<void> {
  const client = accountClient()
  if (!client) return Promise.reject(new Error('Account unavailable'))
  const popup =
    Platform.OS === 'web'
      ? window.open('about:blank', 'loro-sign-in', 'popup,width=500,height=700')
      : null
  if (Platform.OS === 'web' && !popup) return Promise.reject(new Error('Popup blocked'))
  return client.signIn(provider).finally(() => {
    popup?.close()
  })
}
export async function availableProviders(): Promise<OAuthProvider[]> {
  if (!api) return []
  const response = await requestWithTimeout(`${api}/auth/providers`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Provider discovery unavailable')
  return OAuthProvidersSchema.parse(await response.json()).providers
}
