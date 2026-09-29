// What an API failure means to the learner (plan 106), in their words.
import { ApiError } from '@shared/api/client';
import type { Copy } from '@shared/copy';

/** The local time an allowance resets, e.g. "03:00". */
export function resetTime(locale: string, resetsAt: number): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(resetsAt);
}

export function problemText(c: Copy, error: unknown): string {
  if (!(error instanceof ApiError)) return c.account.errors.generic;
  if (error.code === 'OFFLINE' || error.code === 'TIMEOUT') return c.account.errors.offline;
  if (error.code === 'LIMIT_REACHED') {
    const at = error.extra.resets_at;
    return typeof at === 'number' ? c.account.spent(resetTime(c.locale, at)) : c.account.errors.generic;
  }
  if (error.code === 'RATE_LIMITED') return c.account.errors.tooMany;
  if (error.code === 'PROVIDER_UNAVAILABLE') return c.account.errors.unavailable;
  if (error.code === 'UNAUTHENTICATED') return c.account.needed;
  if (error.code === 'NOT_FOUND') return c.share.notFound;
  if (error.status === 422) return c.account.errors.badCode;
  return c.account.errors.generic;
}
