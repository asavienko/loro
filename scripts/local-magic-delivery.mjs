/**
 * Development-only email-code receiver for loopback AUTH_MAGIC_DELIVERY_URL.
 * Never logs the address or code. Writes the latest accepted payload to .tmp.
 */
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_PORT = 8787
export const DELIVERY_PATH = '/send'
export const INBOX_PATH = join(root, '.tmp', 'loro-magic-delivery.json')

export function authorized(header, token) {
  return Boolean(token) && header === `Bearer ${token}`
}

export function parseDelivery(body) {
  const payload = JSON.parse(body)
  if (
    typeof payload.email !== 'string' ||
    typeof payload.code !== 'string' ||
    typeof payload.expires_in !== 'number'
  )
    throw new Error('invalid delivery payload')
  return {
    email: payload.email,
    code: payload.code,
    expires_in: payload.expires_in,
    received_at: Date.now(),
  }
}

export function createDeliveryServer({ token, inboxPath = INBOX_PATH, host = '127.0.0.1' }) {
  if (!token) throw new Error('AUTH_MAGIC_DELIVERY_TOKEN is required')
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== DELIVERY_PATH) {
      response.writeHead(404)
      response.end()
      return
    }
    if (!authorized(request.headers.authorization, token)) {
      response.writeHead(401)
      response.end()
      return
    }
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      void (async () => {
        try {
          const delivery = parseDelivery(Buffer.concat(chunks).toString('utf8'))
          await mkdir(dirname(inboxPath), { recursive: true })
          await writeFile(inboxPath, JSON.stringify(delivery), { mode: 0o600 })
          response.writeHead(204)
          response.end()
        } catch {
          response.writeHead(400)
          response.end()
        }
      })()
    })
  })
  return {
    listen: (port = DEFAULT_PORT) =>
      new Promise((resolve) => {
        server.listen(port, host, () => resolve(server))
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) {
  const token = process.env.AUTH_MAGIC_DELIVERY_TOKEN
  const port = Number(process.env.AUTH_MAGIC_DELIVERY_PORT ?? DEFAULT_PORT)
  const delivery = createDeliveryServer({ token })
  await delivery.listen(port)
}
