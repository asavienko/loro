/** SQLite cannot keep a transaction open across async work. Compute first, commit synchronously. */
export function synchronousResult<T>(value: T): T {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value
  ) {
    throw new Error('Persistence transactions must be synchronous')
  }
  return value
}
