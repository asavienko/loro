// A provider's sign-in page on iOS and Android (src/shared/api/oauth.ts on the web; metro.config.js
// swaps this in): the page opens in an auth session (ASWebAuthenticationSession, Custom Tabs) that
// closes when it redirects to the app's scheme, and the ticket comes back here — the app never
// leaves. The PKCE pair comes from expo-crypto, as Hermes has no Web Crypto digest.
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
// Types only: metro maps the shared module to this one, so a value import would import itself.
import type { Pending, Returned } from '../shared/api/oauth';

export type { Pending, Returned };

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** The query of the address the page redirected to (React Native's URLSearchParams can't read). */
function queryOf(url: string): Record<string, string> {
  const query = url.split('#')[0]?.split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key) out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return out;
}

let pending: Pending | null = null;

export function providerPageAvailable(): boolean {
  return true;
}

/** The app's scheme (loro, or loro-dev for a development build): the server lists both. */
export function returnAddress(): string {
  const scheme = Constants.expoConfig?.scheme;
  return `${typeof scheme === 'string' ? scheme : 'loro'}://account`;
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const challenge = base64url(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

export async function visitProviderPage(url: string, returnTo: string, next: Pending): Promise<Returned | 'left' | 'cancelled'> {
  // One page at a time: a second would replace the first's verifier and fail its return.
  if (pending) return 'cancelled';
  pending = next;
  const result = await WebBrowser.openAuthSessionAsync(url, returnTo);
  if (result.type !== 'success') {
    pending = null;
    return 'cancelled';
  }
  const { state, ticket, error } = queryOf(result.url);
  return { state, ticket, error };
}

export function takePending(): Pending | null {
  const taken = pending;
  pending = null;
  return taken;
}
