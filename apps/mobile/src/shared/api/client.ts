// The app's one way to the API (plan 106). Every failure is an ApiError whose `code` is the
// problem-details code the API sends, or OFFLINE / TIMEOUT / BAD_REPLY when there was no answer to
// read. A signed-in request carries the access token; a 401 refreshes it once and tries again.

/** The API's base URL, ending in /v1. Expo inlines EXPO_PUBLIC_* values when it bundles. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');

/** A path the API returned (a cover, a song), as a URL the app can load. */
export function apiUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Whether the failure means the API couldn't be reached, rather than that it said no. */
export const unreachable = (error: unknown) => error instanceof ApiError && (error.code === 'OFFLINE' || error.code === 'TIMEOUT');

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Sends the access token when signed in (`optional`), or fails without one (`required`). */
  auth?: 'none' | 'optional' | 'required';
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface TokenSource {
  /** A current access token, or null when signed out. */
  access(): Promise<string | null>;
  /** After a 401: a fresh one, or null when the session is gone. */
  renew(): Promise<string | null>;
}

let tokens: TokenSource = { access: async () => null, renew: async () => null };

/** The session registers how to get tokens (src/shared/api/session.ts). */
export function setTokenSource(source: TokenSource): void {
  tokens = source;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  // Cancelled before it went out (while a token was being fetched): nothing to send.
  if (options.signal?.aborted) throw new ApiError(0, 'CANCELLED', 'Cancelled');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new ApiError(0, 'CANCELLED', 'Cancelled');
    throw controller.signal.aborted ? new ApiError(0, 'TIMEOUT', 'The server took too long') : new ApiError(0, 'OFFLINE', 'The server could not be reached');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new ApiError(response.status, 'BAD_REPLY', 'The reply was not JSON');
  }
  if (response.ok) return body as T;
  const problem = isObject(body) ? body : {};
  const { code, detail, title, ...extra } = problem;
  throw new ApiError(response.status, typeof code === 'string' ? code : 'HTTP_ERROR', typeof detail === 'string' ? detail : typeof title === 'string' ? title : `HTTP ${response.status}`, extra);
}

/** JSON from the API, or an ApiError. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? 'optional';
  const token = auth === 'none' ? null : await tokens.access();
  if (auth === 'required' && !token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first');
  const response = await send(path, options, token);
  if (response.status === 401 && token) {
    const renewed = await tokens.renew();
    if (renewed) return read<T>(await send(path, options, renewed));
    if (auth === 'optional') return read<T>(await send(path, options, null));
  }
  return read<T>(response);
}
