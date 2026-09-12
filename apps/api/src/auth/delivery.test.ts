import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverMagicCode } from './delivery.js'
import { LOCAL_INBOX_DELIVERY, LOCAL_INBOX_PATH } from './settings.js'

describe('deliverMagicCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the host inbox without fetching', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loro-inbox-'))
    const inbox = join(dir, 'loro-magic-delivery.json')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await deliverMagicCode(
      LOCAL_INBOX_DELIVERY,
      'token',
      { email: 'learner@example.test', code: '123456', expires_in: 600 },
      inbox,
    )
    expect(fetchMock).not.toHaveBeenCalled()
    const stored = JSON.parse(await readFile(inbox, 'utf8')) as { code: string }
    expect(stored.code).toBe('123456')
    await rm(dir, { recursive: true, force: true })
  })

  it('posts HTTPS webhooks and rejects an unsuccessful status', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 503 })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      deliverMagicCode('https://delivery.example.test/send', 'token', {
        email: 'learner@example.test',
        code: '123456',
        expires_in: 600,
      }),
    ).rejects.toThrow('Delivery unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(LOCAL_INBOX_PATH).toBe('/tmp/loro-magic-delivery.json')
  })
})
