// The API, in memory: what the app's `fetch` and `XMLHttpRequest` reach in the end-to-end suite.
// It answers as apps/api does (the same paths, bodies and problem codes), from the server's seed
// (packages/content/v2, through the unit tests' fixture) and from what the learner does here: the
// accounts, sessions, sets, albums, songs, saves and progress it is asked to keep.
//
// A test reads what was asked (`requests`), what the "email" said (`mail`), and can make the server
// unreachable (`offline`), slow or failing for one route (`failNext`). A request no route answers is
// recorded in `unhandled` and fails the test (e2e/setup.ts), so the fake can't silently fall behind
// the app.
import { fixturePack, FIXTURE } from '@shared/content/fixture';
import type { ContentPack, LanguageCode, LanguageList } from '@shared/content';
import { installLibrary, libraryRoutes } from './library';

export interface Recorded {
  method: string;
  /** The path after /v1, with its query. */
  path: string;
  body: unknown;
  /** The user the bearer token belongs to, if any. */
  userId: string | null;
}

export interface Reply {
  status: number;
  body?: unknown;
  /** Raw text instead of JSON (a clip, a song). */
  text?: string;
  contentType?: string;
}

export interface Request {
  method: string;
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  /** The signed-in user, or null for no or a bad token. */
  user: User | null;
}

export interface User {
  id: string;
  email: string | null;
  provider: string;
  displayName: string | null;
}

export type Handler = (req: Request, api: FakeApi) => Reply | Promise<Reply>;

export interface Route {
  method: string;
  /** `/library/sets/:id`; a `*` matches the rest. */
  pattern: string;
  handler: Handler;
}

/** Problem details, as the API sends them. */
export const problem = (status: number, code: string, detail = code): Reply => ({ status, body: { type: 'about:blank', title: code, status, code, detail } });
export const json = (body: unknown, status = 200): Reply => ({ status, body });
export const noContent = (): Reply => ({ status: 204 });

/** How long the fake's access tokens live, in seconds. */
const ACCESS_TTL_S = 900;

let ids = 0;
/** A UUIDv7-shaped id, unique within the run. */
export function newId(): string {
  ids++;
  const hex = ids.toString(16).padStart(12, '0');
  return `0190a000-0000-7000-8000-${hex}`;
}

/** What a learner may have written for them in a day (the API's `libraryDailyLimit`). */
export interface DailyLimits {
  phrases: number;
  cover: number;
  song: number;
  lyrics: number;
}

export const DEFAULT_LIMITS: DailyLimits = { phrases: 30, cover: 10, song: 5, lyrics: 20 };

/** What a learner may keep (the API's `libraryStorageLimit`). */
export interface KeptLimits {
  sets: number;
  albums: number;
  songs: number;
}

export const DEFAULT_KEPT: KeptLimits = { sets: 100, albums: 30, songs: 120 };

export class FakeApi {
  /** Every request the app made, in order. */
  requests: Recorded[] = [];
  /** Requests no route answers: the suite fails on any. */
  unhandled: string[] = [];
  /** No network: every request fails as a fetch does with no connection. */
  offline = false;
  /** The six-digit codes "emailed", newest last. */
  mail: { email: string; code: string }[] = [];
  /** Ways of signing in the server offers. */
  capabilities = { email: true, google: true, apple: true };

  users = new Map<string, User>();
  /** access token → user id */
  access = new Map<string, string>();
  /** refresh token → user id */
  refresh = new Map<string, string>();
  /** user id → progress and its revision */
  progress = new Map<string, { progress: Record<string, unknown> | null; revision: number }>();
  /** user id → kind → used today */
  usage = new Map<string, Partial<Record<keyof DailyLimits, number>>>();
  /** user id → the UTC day `usage` counts */
  private usageDays = new Map<string, string>();
  limits: DailyLimits = { ...DEFAULT_LIMITS };
  kept: KeptLimits = { ...DEFAULT_KEPT };
  /** A clip's file name ('es-ES-cafe-01.mp3') → where it stands; a clip not listed is ready. */
  clips = new Map<string, 'ready' | 'rendering' | 'failed' | 'missing'>();
  /** Answers queued for a route, used once each: `failNext('POST /library/sets', problem(…))`. */
  private queued = new Map<string, Reply[]>();
  private routes: Route[] = [];
  /** Shared state the library routes keep (e2e/fakes/library.ts). */
  store: Record<string, any> = {};
  /** The languages GET /library/languages lists. */
  languages: LanguageList = { version: 'fixture', languages: FIXTURE.languages };

  constructor() {
    this.routes = [...coreRoutes, ...libraryRoutes];
    installLibrary(this);
  }

  /** Answers the next request to `route` ("METHOD /path", the path as the app sends it, no query) with `reply`. */
  failNext(route: string, reply: Reply = problem(500, 'INTERNAL')): void {
    const list = this.queued.get(route) ?? [];
    list.push(reply);
    this.queued.set(route, list);
  }

  /** A signed-up account, as if it had signed in on another device before: the email code works for it. */
  addUser(email: string, displayName: string | null = null): User {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) return existing;
    const user: User = { id: newId(), email, provider: 'email', displayName };
    this.users.set(user.id, user);
    return user;
  }

  /** A session for `user`, as a sign-in reply gives it. */
  issue(user: User): { access_token: string; refresh_token: string; expires_in: number } {
    const access = `access-${newId()}`;
    const refresh = `refresh-${newId()}`;
    this.access.set(access, user.id);
    this.refresh.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TTL_S };
  }

  userByEmail(email: string): User | undefined {
    return [...this.users.values()].find((u) => u.email === email);
  }

  /** The newest code mailed to `email`. */
  codeFor(email: string): string {
    const found = [...this.mail].reverse().find((m) => m.email === email.toLowerCase());
    if (!found) throw new Error(`No code was mailed to ${email}`);
    return found.code;
  }

  /** The allowances count a UTC day: a new day starts them again. */
  private today(userId: string): void {
    const day = new Date(Date.now()).toISOString().slice(0, 10);
    if (this.usageDays.get(userId) === day) return;
    this.usage.delete(userId);
    this.usageDays.set(userId, day);
  }

  used(userId: string, kind: keyof DailyLimits): number {
    this.today(userId);
    return this.usage.get(userId)?.[kind] ?? 0;
  }

  /** Gives back one use of today's allowance, when what it paid for failed. */
  refund(userId: string, kind: keyof DailyLimits): void {
    const now = this.used(userId, kind);
    if (now > 0) this.usage.set(userId, { ...this.usage.get(userId), [kind]: now - 1 });
  }

  /** Counts one use of `kind`; false when the day's allowance is spent. */
  spend(userId: string, kind: keyof DailyLimits, count = 1): boolean {
    const now = this.used(userId, kind);
    if (now + count > this.limits[kind]) return false;
    this.usage.set(userId, { ...this.usage.get(userId), [kind]: now + count });
    return true;
  }

  /** Requests to one route ("METHOD /path" without the query). */
  calls(route: string): Recorded[] {
    return this.requests.filter((r) => `${r.method} ${r.path.split('?')[0]}` === route);
  }

  /** The course's pack as the server builds it for `user` (their own and saved sets with it). */
  pack(targetLang: LanguageCode, user: User | null): ContentPack {
    const base = fixturePack(targetLang);
    const withClips = { ...base, phrases: base.phrases.map((p) => ({ ...p, audio: clipsFor(p, targetLang) })) };
    const extra = this.store.packExtras?.(targetLang, user) as Partial<ContentPack> | undefined;
    if (!extra) return withClips;
    return {
      ...withClips,
      version: `${withClips.version}-${user?.id ?? 'anon'}-${this.store.revision ?? 0}`,
      sets: [...withClips.sets, ...(extra.sets ?? [])],
      phrases: [...withClips.phrases, ...(extra.phrases ?? [])],
      albums: [...withClips.albums, ...(extra.albums ?? [])],
      ...(extra.covers ? { covers: extra.covers } : {}),
    };
  }

  // ---------- transport ----------

  /** The app's `fetch`. */
  fetch = async (input: string | URL | { url: string }, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}): Promise<FakeResponse> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (init.signal?.aborted) throw abortError();
    const reply = await this.answer(init.method ?? 'GET', url, init.headers ?? {}, init.body);
    if (init.signal?.aborted) throw abortError();
    return new FakeResponse(reply);
  };

  /** One request, answered. A thrown TypeError is the network failing, as `fetch` does. */
  async answer(method: string, url: string, headers: Record<string, string>, rawBody: string | undefined | null): Promise<Reply> {
    if (this.offline) throw new TypeError('Network request failed');
    const at = url.indexOf('/v1/');
    const path = at >= 0 ? url.slice(at + 3) : url.replace(/^https?:\/\/[^/]+/, '');
    const [bare, search = ''] = path.split('?');
    let body: unknown = undefined;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    const auth = headers.Authorization ?? headers.authorization;
    const userId = auth?.startsWith('Bearer ') ? (this.access.get(auth.slice(7)) ?? null) : null;
    this.requests.push({ method, path, body, userId });
    // A bearer the server doesn't know is refused, as an expired token is.
    if (auth && !userId) return problem(401, 'UNAUTHENTICATED', 'Token expired');
    const queued = this.queued.get(`${method} ${bare}`);
    if (queued && queued.length > 0) return queued.shift()!;
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = match(route.pattern, bare);
      if (!params) continue;
      const query = Object.fromEntries(new URLSearchParams(search));
      return route.handler({ method, path: bare, query, params, body, user: userId ? (this.users.get(userId) ?? null) : null }, this);
    }
    this.unhandled.push(`${method} ${bare}`);
    return problem(404, 'NOT_FOUND', `No fake route for ${method} ${bare}`);
  }
}

/** Matches `/library/sets/:id` against a path; null when it doesn't. */
function match(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/');
  const got = path.split('/');
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i] === '*') {
      params.rest = got.slice(i).map(decodeURIComponent).join('/');
      return params;
    }
    if (got[i] === undefined) return null;
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(got[i]);
    else if (want[i] !== got[i]) return null;
  }
  return want.length === got.length ? params : null;
}

const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });

/** A phrase's clips, one per language it is written in, as the API's `speechFor` lists them. */
export function clipsFor(p: { id: string; translations: Partial<Record<string, string>> }, targetLang: string): Partial<Record<LanguageCode, string>> {
  const langs = [targetLang, ...Object.keys(p.translations)];
  return Object.fromEntries(langs.map((lang) => [lang, `/library/speech/${lang}-${p.id}.mp3?v=e2e`])) as Partial<Record<LanguageCode, string>>;
}

/** Enough of a fetch Response for src/shared/api/client.ts and the clip checks. */
export class FakeResponse {
  readonly status: number;
  readonly ok: boolean;
  private readonly reply: Reply;
  readonly headers: { get: (name: string) => string | null };
  constructor(reply: Reply) {
    this.reply = reply;
    this.status = reply.status;
    this.ok = reply.status >= 200 && reply.status < 300;
    const type = reply.contentType ?? (reply.text !== undefined ? 'text/plain' : 'application/json');
    this.headers = { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) };
  }
  async json(): Promise<unknown> {
    if (this.reply.text !== undefined) return JSON.parse(this.reply.text);
    if (this.reply.body === undefined) throw new SyntaxError('Unexpected end of JSON input');
    return JSON.parse(JSON.stringify(this.reply.body));
  }
  async text(): Promise<string> {
    if (this.reply.text !== undefined) return this.reply.text;
    return this.reply.body === undefined ? '' : JSON.stringify(this.reply.body);
  }
}

/** The app's `XMLHttpRequest` (the native clip checks use it): answered by the same fake. */
export function fakeXhr(api: () => FakeApi) {
  return class FakeXMLHttpRequest {
    status = 0;
    responseText = '';
    readyState = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private method = 'GET';
    private url = '';
    private aborted = false;
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
      this.readyState = 1;
    }
    setRequestHeader() {}
    send(body?: string) {
      api()
        .answer(this.method, this.url, {}, body)
        .then(
          async (reply) => {
            if (this.aborted) return;
            this.status = reply.status;
            this.responseText = await new FakeResponse(reply).text();
            this.readyState = 4;
            this.onload?.();
          },
          () => {
            if (this.aborted) return;
            this.readyState = 4;
            this.onerror?.();
          },
        );
    }
    abort() {
      if (this.aborted) return;
      this.aborted = true;
      this.onabort?.();
    }
  };
}

// ---------- the routes every test needs: languages, the pack, accounts, usage and progress ----------

const signInReply = (api: FakeApi, user: User) => ({ ...api.issue(user), user: { id: user.id, provider: user.provider }, device_id: newId() });

const coreRoutes: Route[] = [
  { method: 'GET', pattern: '/library/languages', handler: (_req, api) => json(api.languages) },
  {
    method: 'GET',
    pattern: '/library/pack',
    handler: (req, api) => {
      const target = req.query.target as LanguageCode;
      if (!FIXTURE.languages.some((l) => l.code === target)) return problem(400, 'VALIDATION', 'Unknown course');
      return json(api.pack(target, req.user));
    },
  },
  // A phrase's clip: where it stands (`.json`), or the clip itself.
  {
    method: 'GET',
    pattern: '/library/speech/:clip',
    handler: (req, api) => {
      const clip = req.params.clip;
      const key = clip.replace(/\.json$/, '.mp3');
      const state = api.clips.get(key) ?? 'ready';
      if (state === 'missing') return problem(404, 'NOT_FOUND');
      if (clip.endsWith('.json')) return json({ status: state });
      return { status: 200, text: 'ID3', contentType: 'audio/mpeg' };
    },
  },
  { method: 'GET', pattern: '/auth/capabilities', handler: (_req, api) => json(api.capabilities) },
  {
    method: 'POST',
    pattern: '/auth/magic-link',
    handler: (req, api) => {
      const email = String(req.body?.email ?? '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return problem(422, 'VALIDATION', 'Enter a valid email');
      const code = String(100000 + ((api.mail.length * 7919 + email.length * 104729) % 900000));
      api.mail.push({ email, code });
      return json({ sent: true }, 202);
    },
  },
  {
    method: 'POST',
    pattern: '/auth/magic-link/verify',
    handler: (req, api) => {
      const email = String(req.body?.email ?? '');
      const code = String(req.body?.code ?? '');
      const sent = [...api.mail].reverse().find((m) => m.email === email);
      if (!sent || sent.code !== code) return problem(401, 'INVALID_CODE', 'That code is wrong or has expired');
      api.mail = api.mail.filter((m) => m !== sent);
      const user = api.addUser(email);
      return json(signInReply(api, user));
    },
  },
  {
    method: 'POST',
    pattern: '/auth/:provider/start',
    handler: (req) => {
      const provider = req.params.provider;
      if (provider !== 'google' && provider !== 'apple') return problem(404, 'NOT_FOUND');
      const state = `state-${newId()}`;
      return json({ authorization_url: `https://accounts.${provider}.test/authorize?state=${state}&redirect_uri=${encodeURIComponent(req.body?.redirect_uri ?? '')}`, state });
    },
  },
  {
    method: 'POST',
    pattern: '/auth/exchange',
    handler: (req, api) => {
      const ticket = String(req.body?.ticket ?? '');
      const [, provider, email] = /^ticket:(google|apple):(.+)$/.exec(ticket) ?? [];
      if (!provider) return problem(401, 'UNAUTHENTICATED', 'Unknown ticket');
      let user = api.userByEmail(email);
      if (!user) {
        user = { id: newId(), email, provider, displayName: null };
        api.users.set(user.id, user);
      }
      return json(signInReply(api, user));
    },
  },
  {
    method: 'POST',
    pattern: '/auth/refresh',
    handler: (req, api) => {
      const token = String(req.body?.refresh_token ?? '');
      const userId = api.refresh.get(token);
      if (!userId) return problem(401, 'UNAUTHENTICATED', 'Refresh token refused');
      api.refresh.delete(token);
      const { access_token, refresh_token, expires_in } = api.issue(api.users.get(userId)!);
      return json({ access_token, refresh_token, expires_in });
    },
  },
  {
    method: 'POST',
    pattern: '/auth/logout',
    handler: (req, api) => {
      api.refresh.delete(String(req.body?.refresh_token ?? ''));
      return noContent();
    },
  },
  {
    method: 'GET',
    pattern: '/library/profile',
    handler: (req) => (req.user ? json({ displayName: req.user.displayName }) : problem(401, 'UNAUTHENTICATED')),
  },
  {
    method: 'POST',
    pattern: '/library/profile',
    handler: (req) => {
      if (!req.user) return problem(401, 'UNAUTHENTICATED');
      const name = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : null;
      if (name !== null && name.length > 40) return problem(422, 'VALIDATION', 'Too long');
      req.user.displayName = name || null;
      return json({ displayName: req.user.displayName });
    },
  },
  {
    method: 'GET',
    pattern: '/library/progress',
    handler: (req, api) => (req.user ? json(api.progress.get(req.user.id) ?? { progress: null, revision: 0 }) : problem(401, 'UNAUTHENTICATED')),
  },
  {
    method: 'POST',
    pattern: '/library/progress',
    handler: (req, api) => {
      if (!req.user) return problem(401, 'UNAUTHENTICATED');
      const current = api.progress.get(req.user.id) ?? { progress: null, revision: 0 };
      if (req.body?.baseRevision !== current.revision) return problem(409, 'CONFLICT', 'Progress changed meanwhile');
      const next = { progress: req.body.progress as Record<string, unknown>, revision: current.revision + 1 };
      api.progress.set(req.user.id, next);
      return json({ revision: next.revision });
    },
  },
];
