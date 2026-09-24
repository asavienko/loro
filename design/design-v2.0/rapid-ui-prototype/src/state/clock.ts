// The only module that reads the wall clock or constructs a Date. Everything
// else takes `now` (epoch ms) as an argument, which keeps the state machine
// pure and testable.
export const clock = {
  now: (): number => Date.now(),
  formatTime: (ms: number): string =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  formatDayTime: (ms: number): string =>
    new Date(ms).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
  isSameDay: (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString(),
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** "0:07", "1:12" — elapsed time from real milliseconds. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** "just now", "3m ago", "2d ago" — how long ago a real event happened. */
export function formatAgo(ms: number): string {
  return ms < MINUTE ? 'just now' : `${formatInterval(ms)} ago`;
}

/** "10m", "5h", "4d" — a duration from real milliseconds (at least 1m). */
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / DAY)}d`;
}
