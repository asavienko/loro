import { LoroError } from './errors.js'

/**
 * Parse a shared Zod contract at an HTTP boundary.
 *
 * Controllers and services used to spell this out next to every route. A failed
 * parse is always VALIDATION_FAILED — the client dead-letters, never retries.
 */
export function parseContract<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
  detail?: string,
): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new LoroError('VALIDATION_FAILED', detail)
  return result.data
}
