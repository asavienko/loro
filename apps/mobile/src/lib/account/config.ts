/** A build-time endpoint, never a learner-entered credential destination. */
export function accountApiUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return null
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
      return null
    return value.replace(/\/$/, '')
  } catch {
    return null
  }
}
