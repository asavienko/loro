import { AuthCapabilitiesSchema } from '@loro/core/api/current'
import { OAuthProvidersSchema, type OAuthProvider } from '@loro/core/api/oauth'
import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import type { AuthorizationPorts } from './client'
import { configuredNativeRedirectUri } from './redirect'
import { accountClient } from '../lib/account/runtime'
import { bundledApiUrl } from '../lib/account/config'
import { requestWithTimeout } from '../lib/backend'
import { pkceChallenge, randomPopupName, randomVerifier } from './pkce'
import { watchPopupRedirect } from './popup'

let pendingPopup: Window | null = null

export const authorizationPorts: AuthorizationPorts = {
  random: randomVerifier,
  challenge: pkceChallenge,
  redirect:
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/account`
      : configuredNativeRedirectUri(Constants.expoConfig?.extra?.nativeRedirectUri),
  authorize: async (url, redirect, windowName = 'loro-sign-in') => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const popup =
        pendingPopup && !pendingPopup.closed ? pendingPopup : window.open(url, windowName)
      if (!popup) throw new Error('Popup blocked')
      try {
        popup.location.assign(url)
      } catch {
        // The named window may already be navigating.
      }
      return watchPopupRedirect(popup, redirect)
    }
    const result = await WebBrowser.openAuthSessionAsync(url, redirect, {
      windowName,
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
export function beginSignIn(provider: OAuthProvider): Promise<boolean> {
  const client = accountClient()
  if (!client) return Promise.reject(new Error('Account unavailable'))
  // Keep the surface owned by this attempt. A fixed popup name lets an old finally
  // handler close a newer attempt that reused the same browser window.
  const popupName = randomPopupName()
  const popup =
    Platform.OS === 'web'
      ? window.open('about:blank', popupName, 'popup,width=500,height=700')
      : null
  if (Platform.OS === 'web' && !popup) return Promise.reject(new Error('Popup blocked'))
  pendingPopup = popup
  client.cancelSignIn()
  return client.signIn(provider, popupName).finally(() => {
    pendingPopup = null
    try {
      popup?.close()
    } catch {
      // Some embedded browsers reject close() on a window they already discarded.
    }
  })
}
export async function availableProviders(): Promise<OAuthProvider[]> {
  const api = bundledApiUrl()
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

/** Read configured email delivery independently from browser OAuth discovery. */
export async function availableCapabilities(): Promise<{
  apple: boolean
  google: boolean
  email: boolean
}> {
  const api = bundledApiUrl()
  if (!api) return { apple: false, google: false, email: false }
  const response = await requestWithTimeout(`${api}/auth/capabilities`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Authentication capabilities unavailable')
  return AuthCapabilitiesSchema.parse(await response.json())
}
