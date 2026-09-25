// The only module that reads the wall clock or constructs a Date. Everything
// else takes `now` (epoch ms) as an argument, which keeps the state machine
// pure and testable.
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const clock = {
  now: (): number => Date.now(),
};

/** Local calendar day, e.g. "2026-09-24"; the key for "today" counts. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Whether `day` ("2026-09-24") is a real date that is the local day of `ms` in some time zone
 * (UTC−12 to UTC+14): a stamp a device could have written for that moment.
 */
export function isLocalDayOf(day: unknown, ms: number): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  // Date.UTC rolls an impossible date ("2026-02-30") over into the next month.
  if (new Date(start).toISOString().slice(0, 10) !== day) return false;
  return ms >= start - 14 * HOUR && ms < start + DAY + 12 * HOUR;
}

/** Start of the local day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The same local time `days` calendar days later (or earlier): a day across a clock change isn't 24 h. */
export function addLocalDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Start of the local week (Monday) containing `ms`. */
export function startOfLocalWeek(ms: number): number {
  const d = new Date(startOfLocalDay(ms));
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return d.getTime();
}

/** "14:20" in the learner's UI language, always a 24-hour clock without a leading-zero hour. */
export function formatClockTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}

/** "24 Sep" or "24 сент." */
export function formatShortDate(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(ms));
}

/** "0:07", "1:12" — elapsed time from real milliseconds. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * A future moment relative to now: "in 10 minutes", "in 4 days", and "today at
 * 14:20" when it falls later today and more than an hour away.
 */
export function formatWhen(at: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = at - now;
  if (diff <= 0) return rtf.format(0, 'minute');
  if (diff < HOUR) return rtf.format(Math.max(1, Math.round(diff / MINUTE)), 'minute');
  if (localDay(at) === localDay(now)) {
    return `${rtf.format(0, 'day')}, ${formatClockTime(at, locale)}`;
  }
  const days = Math.round((startOfLocalDay(at) - startOfLocalDay(now)) / DAY);
  if (days < 45) return rtf.format(days, 'day');
  if (days < 365 * 2) return rtf.format(Math.round(days / 30), 'month');
  return rtf.format(Math.round(days / 365), 'year');
}

/** A past moment: "just now", "5 minutes ago", "yesterday". */
export function formatAgo(at: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = now - at;
  if (diff < MINUTE) return rtf.format(0, 'second');
  if (diff < HOUR) return rtf.format(-Math.round(diff / MINUTE), 'minute');
  // Hours only while it's still the same day and not long ago; then "yesterday", "3 days ago".
  if (diff < 12 * HOUR && localDay(at) === localDay(now)) return rtf.format(-Math.round(diff / HOUR), 'hour');
  return rtf.format(-Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / DAY), 'day');
}

/** A duration: "10 min", "4 days", "3 months" — for rating previews. */
export function formatInterval(ms: number, locale: string): string {
  // Bulgarian's short day is a bare "д", which doesn't read as days: spell it out ("5 дни").
  const display = (u: Intl.NumberFormatOptions['unit']) => (u === 'day' && locale.startsWith('bg') ? 'long' : 'short');
  // English short units read "10 min", "3 hr" in US English; British English says "10 mins".
  const unitLocale = locale.startsWith('en') ? 'en-US' : locale;
  const unit = (value: number, u: Intl.NumberFormatOptions['unit']) =>
    new Intl.NumberFormat(unitLocale, { style: 'unit', unit: u, unitDisplay: display(u), maximumFractionDigits: 0 }).format(value);
  if (ms < HOUR) return unit(Math.max(1, Math.round(ms / MINUTE)), 'minute');
  if (ms < DAY) return unit(Math.round(ms / HOUR), 'hour');
  const days = Math.round(ms / DAY);
  // Days up to 100, so neighbouring rating previews (Hard 52 days, Easy 71 days) stay distinct.
  if (days <= 100) return unit(days, 'day');
  if (days < 365 * 2) return unit(Math.round(days / 30), 'month');
  return unit(Math.round(days / 365), 'year');
}
