import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliverMagicCode, type SendEmail } from './delivery.js'
import {
  LOCAL_INBOX_DELIVERY,
  LOCAL_INBOX_PATH,
  RESEND_DELIVERY,
  SES_DELIVERY,
} from './settings.js'

const payload = { email: 'learner@example.test', code: '123456', expires_in: 600 }

describe('deliverMagicCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the host inbox without fetching', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loro-inbox-'))
    const inbox = join(dir, 'loro-magic-delivery.json')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await deliverMagicCode({ url: LOCAL_INBOX_DELIVERY, token: 'token' }, payload, inbox)
    expect(fetchMock).not.toHaveBeenCalled()
    const stored = JSON.parse(await readFile(inbox, 'utf8')) as { code: string }
    expect(stored.code).toBe('123456')
    await rm(dir, { recursive: true, force: true })
  })

  it('posts HTTPS webhooks and rejects an unsuccessful status', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 503 })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      deliverMagicCode({ url: 'https://delivery.example.test/send', token: 'token' }, payload),
    ).rejects.toThrow('Delivery unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(LOCAL_INBOX_PATH).toBe('/tmp/loro-magic-delivery.json')
  })

  it('emails the code through Resend from the configured sender, with its key', async () => {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(Response.json({ id: 'email' })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await deliverMagicCode(
      { url: RESEND_DELIVERY, token: 're_key', from: 'Loro <codes@example.test>' },
      payload,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('error')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_key')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['from']).toBe('Loro <codes@example.test>')
    expect(body['to']).toEqual(['learner@example.test'])
    expect(body['subject']).toBe('123456 is your Loro code')
    expect(body['text']).toContain('10 minutes')
  })

  it('rejects a refused Resend send by its status alone, and needs a key and a sender', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json(
          { name: 'validation_error', message: 'learner@example.test is not allowed' },
          { status: 403 },
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const refused = deliverMagicCode(
      { url: RESEND_DELIVERY, token: 're_key', from: 'codes@example.test' },
      payload,
    )
    await expect(refused).rejects.toMatchObject({ name: 'Resend403' })
    await expect(refused).rejects.not.toThrow('learner@example.test')
    fetchMock.mockClear()
    await expect(
      deliverMagicCode({ url: RESEND_DELIVERY, from: 'codes@example.test' }, payload),
    ).rejects.toThrow('Delivery unavailable')
    await expect(
      deliverMagicCode({ url: RESEND_DELIVERY, token: 're_key' }, payload),
    ).rejects.toThrow('Delivery unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emails the code through SES from the configured sender', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const sent: SendEmailCommand[] = []
    const send: SendEmail = (command) => {
      sent.push(command)
      return Promise.resolve({ MessageId: 'message' })
    }
    await deliverMagicCode(
      { url: SES_DELIVERY, from: 'Loro <codes@example.test>' },
      payload,
      undefined,
      send,
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sent).toHaveLength(1)
    const input = sent[0]!.input
    expect(input.FromEmailAddress).toBe('Loro <codes@example.test>')
    expect(input.Destination?.ToAddresses).toEqual(['learner@example.test'])
    expect(input.Content?.Simple?.Subject?.Data).toContain('123456')
    expect(input.Content?.Simple?.Body?.Text?.Data).toContain('123456')
    expect(input.Content?.Simple?.Body?.Text?.Data).toContain('10 minutes')
  })

  it('rejects when SES fails or no sender is configured', async () => {
    const failing: SendEmail = () => Promise.reject(new Error('MessageRejected'))
    await expect(
      deliverMagicCode(
        { url: SES_DELIVERY, from: 'codes@example.test' },
        payload,
        undefined,
        failing,
      ),
    ).rejects.toThrow('MessageRejected')
    const send = vi.fn<SendEmail>()
    await expect(deliverMagicCode({ url: SES_DELIVERY }, payload, undefined, send)).rejects.toThrow(
      'Delivery unavailable',
    )
    expect(send).not.toHaveBeenCalled()
  })
})
