import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  authorized,
  createDeliveryServer,
  DELIVERY_PATH,
  parseDelivery,
} from './local-magic-delivery.mjs'

test('accepts a bearer delivery and retains the payload off logs', async () => {
  assert.equal(authorized('Bearer secret', 'secret'), true)
  assert.equal(authorized('Bearer other', 'secret'), false)
  const parsed = parseDelivery('{"email":"a@example.test","code":"123456","expires_in":600}')
  assert.equal(parsed.email, 'a@example.test')
  const inboxPath = join(await mkdtemp(join(tmpdir(), 'loro-magic-')), 'inbox.json')
  const delivery = createDeliveryServer({ token: 'secret', inboxPath })
  const server = await delivery.listen(0)
  const { port } = server.address()
  const accepted = await fetch(`http://127.0.0.1:${port}${DELIVERY_PATH}`, {
    method: 'POST',
    headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.test', code: '654321', expires_in: 600 }),
  })
  assert.equal(accepted.status, 204)
  const stored = JSON.parse(await readFile(inboxPath, 'utf8'))
  assert.equal(stored.code, '654321')
  const denied = await fetch(`http://127.0.0.1:${port}${DELIVERY_PATH}`, {
    method: 'POST',
    headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.test', code: '000000', expires_in: 600 }),
  })
  assert.equal(denied.status, 401)
  await delivery.close()
})
