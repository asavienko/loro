// The account (plan 106): signing in with a code sent by email, the tokens that keep the learner
// signed in, and signing out. The refresh token is kept in the platform's secret store; the account's
// public details (id, email, display name) in the key-value store, so the app knows who is signed in
// before the network answers. Nothing here touches learner progress: signing in or out keeps it.
import { clock } from '../state/clock';
import { api, ApiError, setTokenSource } from './client';
import { kvGet, kvRemove, kvSet, PLATFORM } from './kv';
import { secretGet, secretRemove, secretSet } from './secrets';

export interface Account {
  userId: string;
  email: string | null;
  provider: string;
  /** Shown beside what the learner shares; null until they give one. */
  displayName: string | null;
}

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionState {
  status: SessionStatus;
  account: Account | null;
}

interface SignInReply {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: { id: string; provider?: string };
  device_id: string;
}

const ACCOUNT_KEY = 'loro.account';
const INSTALLATION_KEY = 'loro.installation';
const REFRESH_KEY = 'loro.refresh';
/** An access token this close to expiry is renewed before use. */
const RENEW_BEFORE_MS = 60_000;

let state: SessionState = { status: 'loading', account: null };
let access: { token: string; expiresAt: number } | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(state: SessionState) => void>();

export function sessionState(): SessionState {
  return state;
}

export function onSessionChange(listener: (state: SessionState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

/** A UUIDv7, as the API's row ids are: the time first, then randomness. */
export function uuid7(now = clock.now()): string {
  const hex = (n: number, width: number) => Math.floor(n).toString(16).padStart(width, '0');
  const random = (width: number) => Array.from({ length: width }, () => hex(Math.random() * 16, 1)).join('');
  const time = hex(now, 12);
  const variant = hex(8 + Math.floor(Math.random() * 4), 1);
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${random(3)}-${variant}${random(3)}-${random(12)}`;
}

/** This installation's id, kept for the life of the app so the API sees one device. */
async function installationId(): Promise<string> {
  const saved = await kvGet(INSTALLATION_KEY);
  if (saved && /^[0-9a-f-]{36}$/.test(saved)) return saved;
  const id = uuid7();
  await kvSet(INSTALLATION_KEY, id);
  return id;
}

const APP_VERSION = '0.1.0';

/** Reads who was signed in on this device; the token itself is checked on the first request. */
export async function loadSession(): Promise<SessionState> {
  const [refresh, saved] = await Promise.all([secretGet(REFRESH_KEY), kvGet(ACCOUNT_KEY)]);
  let account: Account | null = null;
  try {
    account = saved ? (JSON.parse(saved) as Account) : null;
  } catch {
    account = null;
  }
  publish(refresh && account ? { status: 'signedIn', account } : { status: 'signedOut', account: null });
  return state;
}

/** Asks the API to email a six-digit code. */
export async function requestCode(email: string): Promise<void> {
  await api('/auth/magic-link', { method: 'POST', body: { email: email.trim().toLowerCase() }, auth: 'none' });
}

/** Which ways of signing in the API offers. */
export async function signInMethods(): Promise<{ email: boolean; google: boolean; apple: boolean }> {
  return api('/auth/capabilities', { auth: 'none', timeoutMs: 8000 });
}

/** Signs in with the emailed code; the learner's progress on this device stays as it is. */
export async function verifyCode(email: string, code: string): Promise<Account> {
  const reply = await api<SignInReply>('/auth/magic-link/verify', {
    method: 'POST',
    auth: 'none',
    body: {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      anon_id: uuid7(),
      device: { installation_id: await installationId(), platform: PLATFORM, app_version: APP_VERSION },
    },
  });
  access = { token: reply.access_token, expiresAt: clock.now() + reply.expires_in * 1000 };
  await secretSet(REFRESH_KEY, reply.refresh_token);
  const account: Account = { userId: reply.user.id, email: email.trim().toLowerCase(), provider: reply.user.provider ?? 'email', displayName: null };
  await saveAccount(account);
  publish({ status: 'signedIn', account });
  // The display name lives on the server; a failure here leaves it unset, not the sign-in undone.
  void api<{ displayName: string | null }>('/library/profile', { auth: 'required' })
    .then((profile) => updateAccount({ displayName: profile.displayName }))
    .catch(() => {});
  return account;
}

async function saveAccount(account: Account): Promise<void> {
  await kvSet(ACCOUNT_KEY, JSON.stringify(account));
}

/** Changes the account's public details here (after the server accepted them). */
export async function updateAccount(change: Partial<Pick<Account, 'displayName'>>): Promise<void> {
  if (!state.account) return;
  const account = { ...state.account, ...change };
  await saveAccount(account);
  publish({ status: 'signedIn', account });
}

/** Forgets the session on this device; the API is told when it can be reached. */
export async function signOut(): Promise<void> {
  const refresh = await secretGet(REFRESH_KEY);
  access = null;
  await Promise.all([secretRemove(REFRESH_KEY), kvRemove(ACCOUNT_KEY)]);
  publish({ status: 'signedOut', account: null });
  if (refresh) await api('/auth/logout', { method: 'POST', body: { refresh_token: refresh }, auth: 'none', timeoutMs: 5000 }).catch(() => {});
}

/**
 * Browser tabs share one refresh token, and using a spent one ends the session. Where the browser has
 * Web Locks, one tab refreshes at a time, and the next reads the token the first one stored.
 */
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as { locks?: { request: (name: string, run: () => Promise<T>) => Promise<T> } } | undefined)?.locks;
  return locks ? locks.request('loro.refresh', work) : work();
}

/** A new access token from the refresh token, one request at a time; null when the session is over. */
function renew(): Promise<string | null> {
  refreshing ??= oneAtATime(async () => {
    const refresh = await secretGet(REFRESH_KEY);
    if (!refresh) return null;
    try {
      const reply = await api<Omit<SignInReply, 'user' | 'device_id'>>('/auth/refresh', { method: 'POST', body: { refresh_token: refresh }, auth: 'none' });
      access = { token: reply.access_token, expiresAt: clock.now() + reply.expires_in * 1000 };
      await secretSet(REFRESH_KEY, reply.refresh_token);
      return access.token;
    } catch (error) {
      // Refused (expired, revoked or reused): the session is over. Offline: keep it for later.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 422)) {
        access = null;
        await Promise.all([secretRemove(REFRESH_KEY), kvRemove(ACCOUNT_KEY)]);
        publish({ status: 'signedOut', account: null });
        return null;
      }
      throw error;
    }
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

setTokenSource({
  access: async () => {
    if (state.status !== 'signedIn') return null;
    if (access && access.expiresAt - RENEW_BEFORE_MS > clock.now()) return access.token;
    return renew();
  },
  renew,
});
