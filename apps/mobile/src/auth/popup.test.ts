import { describe, expect, it } from 'vitest'
import { watchPopupRedirect } from './popup'

describe('watchPopupRedirect', () => {
  it('returns the same-origin callback once a ticket is present', async () => {
    const popup = { closed: false, location: { href: 'https://accounts.google.com/o/oauth2' } }
    let tick: (() => void) | undefined
    const done = watchPopupRedirect(
      popup,
      'http://localhost:8081/account',
      (next) => {
        tick = next
        return 1 as unknown as ReturnType<typeof setInterval>
      },
      () => 0,
    )
    tick?.()
    popup.location.href = 'http://localhost:8081/account?state=one&ticket=abc'
    tick?.()
    await expect(done).resolves.toBe('http://localhost:8081/account?state=one&ticket=abc')
  })

  it('treats a closed popup as cancellation', async () => {
    const popup = { closed: true, location: { href: 'about:blank' } }
    const done = watchPopupRedirect(
      popup,
      'http://localhost:8081/account',
      (next) => {
        next()
        return 1 as unknown as ReturnType<typeof setInterval>
      },
      () => 0,
    )
    await expect(done).resolves.toBeNull()
  })

  it('ignores the Account page until the provider returns a ticket or error', async () => {
    const popup = { closed: false, location: { href: 'http://localhost:8081/account' } }
    let tick: (() => void) | undefined
    let settled: string | null | undefined
    void watchPopupRedirect(
      popup,
      'http://localhost:8081/account',
      (next) => {
        tick = next
        return 1 as unknown as ReturnType<typeof setInterval>
      },
      () => 0,
    ).then((value) => {
      settled = value
    })
    tick?.()
    expect(settled).toBeUndefined()
    popup.location.href = 'http://localhost:8081/account?error=sign_in_failed'
    tick?.()
    await Promise.resolve()
    expect(settled).toBe('http://localhost:8081/account?error=sign_in_failed')
  })
})
