// Logs, errors and metrics (ADR-0011). Shared code says here what happened — a request and how
// long it took, a save that failed, a sync — and the app's analytics (src/analytics) sends it to
// PostHog. Until a sink is set (tests, a build without a PostHog key) nothing goes anywhere.
// Attributes are scalars the code chose: never phrase text, a learner's words or audio.

export type LogLevel = 'info' | 'warn' | 'error';
export type Attributes = Record<string, string | number | boolean | null | undefined>;

export interface TelemetrySink {
  /** A line for PostHog's logs. */
  log(level: LogLevel, message: string, attributes: Attributes): void;
  /** An exception for PostHog's error tracking. */
  exception(error: unknown, attributes: Attributes): void;
  /** A measurement, recorded as an event with numeric properties. */
  metric(name: string, properties: Attributes): void;
}

let sink: TelemetrySink | null = null;

/** The app's analytics sets where telemetry goes (src/analytics/posthog.ts). */
export function setTelemetrySink(next: TelemetrySink | null): void {
  sink = next;
}

/** Telemetry never breaks what it reports on. */
function send(write: (to: TelemetrySink) => void): void {
  if (!sink) return;
  try {
    write(sink);
  } catch {
    // Dropped.
  }
}

export const log = {
  info: (message: string, attributes: Attributes = {}) => send((to) => to.log('info', message, attributes)),
  warn: (message: string, attributes: Attributes = {}) => send((to) => to.log('warn', message, attributes)),
  error: (message: string, attributes: Attributes = {}) => send((to) => to.log('error', message, attributes)),
};

/**
 * Something failed that the app recovers from (a save, a sync): a log line saying where, and the
 * exception itself when it was one the app didn't expect. An API that said no (a warning) or
 * couldn't be reached (the network's state, not a fault) is not an exception: every request is
 * measured already (`api_request`).
 */
export function reportError(where: string, error: unknown, attributes: Attributes = {}): void {
  const details = { where, ...describeError(error), ...attributes };
  const level: LogLevel = !isApiError(error) ? 'error' : error.status === 0 ? 'info' : 'warn';
  send((to) => to.log(level, `${where} failed`, details));
  if (!isApiError(error)) send((to) => to.exception(error, details));
}

/** Records a measurement: `metric('progress_sync', { duration_ms: 420, outcome: 'merged' })`. */
export function metric(name: string, properties: Attributes): void {
  send((to) => to.metric(name, properties));
}

/** Milliseconds since `start` (a `performance.now()`), whole. */
export const since = (start: number) => Math.round(performance.now() - start);

/** What a log line says of an error: its name, message and, for an ApiError, its status and code. */
export function describeError(error: unknown): Attributes {
  if (isApiError(error)) return { error_name: error.name, error_message: error.message, error_status: error.status, error_code: error.code };
  if (error instanceof Error) return { error_name: error.name, error_message: error.message };
  return { error_name: typeof error, error_message: String(error) };
}

function isApiError(error: unknown): error is Error & { status: number; code: string } {
  return error instanceof Error && error.name === 'ApiError' && 'status' in error && 'code' in error;
}

/** The API's own words for its routes; any other segment of a path is an id, a code or a kind. */
const ROUTE_WORDS = new Set([
  'albums',
  'apple',
  'auth',
  'capabilities',
  'community',
  'cover',
  'covers',
  'decks',
  'delete',
  'delete-account',
  'exchange',
  'generate',
  'google',
  'languages',
  'library',
  'logout',
  'magic-link',
  'me',
  'more',
  'notes',
  'pack',
  'phrases',
  'profile',
  'progress',
  'refresh',
  'reports',
  'retry',
  'saves',
  'sets',
  'shared',
  'song',
  'songs',
  'start',
  'usage',
  'verify',
]);

/**
 * A request's path as a route, so requests group and nothing identifying is sent:
 * `/library/sets/set_8f2/songs?x=1` → `/library/sets/:id/songs`.
 */
export function routeOf(path: string): string {
  const bare = path.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0] ?? '';
  return bare
    .split('/')
    .map((segment) => (segment === '' || segment === 'v1' || ROUTE_WORDS.has(segment) ? segment : ':id'))
    .join('/');
}
