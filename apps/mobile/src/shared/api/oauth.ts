// A provider's sign-in page in the browser (plan 106): the PKCE pair from Web Crypto, and a visit
// that leaves the app — the page comes back to /account with a ticket, and the verifier waits in
// this tab's session storage until it does. On iOS and Android, metro.config.js swaps in
// src/platform/oauth.ts, which opens the page in an auth session and waits for it instead.

export interface Pending {
  verifier: string;
  state: string;
}

/** What the provider's page came back with. */
export interface Returned {
  state?: string;
  ticket?: string;
  error?: string;
}

const PENDING_KEY = 'loro.oauth';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Whether this runtime can sign in with a provider page: a browser with Web Crypto. */
export function providerPageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined' && Boolean(globalThis.crypto?.subtle);
}

/** Where the provider's page sends the learner back to; the server must list it. */
export function returnAddress(): string {
  return `${window.location.origin}/account`;
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

/** Leaves for the provider's page: nothing comes back here — the account screen picks up the return. */
export function visitProviderPage(url: string, _returnTo: string, pending: Pending): Promise<Returned | 'left' | 'cancelled'> {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(url);
  return Promise.resolve('left');
}

/** The verifier and state saved before leaving, once. */
export function takePending(): Pending | null {
  const saved = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  return saved ? (JSON.parse(saved) as Pending) : null;
}
