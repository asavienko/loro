import type { ConsoleMessage, Page } from '@playwright/test'

const failures = new WeakMap<Page, Map<string, number>>()
const reasons = { 401: 'Unauthorized', 503: 'Service Unavailable' } as const

/** Allow one browser-generated resource error for an explicitly injected HTTP failure. */
export function expectResourceError(page: Page, url: string, status: keyof typeof reasons): void {
  const key = `${url}\nFailed to load resource: the server responded with a status of ${status} (${reasons[status]})`
  const pending = failures.get(page) ?? new Map<string, number>()
  pending.set(key, (pending.get(key) ?? 0) + 1)
  failures.set(page, pending)
}

export function consumeExpectedResourceError(page: Page, message: ConsoleMessage): boolean {
  const key = `${message.location().url}\n${message.text()}`
  const pending = failures.get(page)
  const count = pending?.get(key) ?? 0
  if (count === 0) return false
  pending!.set(key, count - 1)
  return true
}
