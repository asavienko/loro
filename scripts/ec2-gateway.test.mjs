import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Exercise the exact inline Lambda source deployed by CloudFormation.
const template = readFileSync(new URL('../infra/ec2/https.yaml', import.meta.url), 'utf8')
const source = template.match(/ZipFile: \|\n([\s\S]*?)\n  Logs:/)[1]
function setup(fetch, accounts = false) {
  const exports = {}
  runInNewContext(source, {
    exports,
    fetch,
    URL,
    AbortSignal,
    Buffer,
    process: {
      env: {
        ORIGIN: 'http://172.31.21.138:8080',
        ACCOUNT_ACCESS: accounts ? 'enabled' : 'disabled',
      },
    },
  })
  return exports.handler
}
const event = (path, method = 'GET') => ({ rawPath: path, requestContext: { http: { method } } })
test('public gateway rejects writes, legacy endpoints and alternate path encodings', async () => {
  const handler = setup(() => {
    throw new Error('must not reach EC2')
  })
  for (const [path, method] of [
    ['/v1/sync/pull', 'GET'],
    ['/v1/ai/scene', 'GET'],
    ['/v1/auth/google/start', 'GET'],
    ['/v1/health/ready', 'POST'],
    ['/v1/health/ready/', 'GET'],
    ['/v1/content/v2/../sync/pull', 'GET'],
    ['/v1/%68ealth', 'GET'],
  ])
    assert.equal((await handler(event(path, method))).statusCode, 404)
})
test('forwards locale queries but no caller credentials or arbitrary upstream URL', async () => {
  let called = false
  const handler = setup(async (url, options) => {
    called = true
    assert.equal(
      url.toString(),
      'http://172.31.21.138:8080/v1/content/v2/manifest?native=bg&target=ru-RU',
    )
    assert.equal(Object.keys(options.headers).length, 0)
    assert.equal(options.redirect, 'manual')
    return Response.json({ phraseCount: 31 })
  })
  const response = await handler({
    ...event('/v1/content/v2/manifest'),
    headers: { authorization: 'Bearer private', cookie: 'private' },
    queryStringParameters: { native: 'bg', target: 'ru-RU', url: 'http://attacker.test' },
  })
  assert.equal(called, true)
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(response.body), { phraseCount: 31 })
})
test('preserves failing health and reports transport failure without internal errors', async () => {
  const degraded = setup(async () => Response.json({ status: 'degraded' }, { status: 503 }))
  assert.equal((await degraded(event('/v1/health/ready'))).statusCode, 503)
  const offline = setup(() => {
    throw new Error('sensitive internal failure')
  })
  const response = await offline(event('/v1/health/ready'))
  assert.equal(response.statusCode, 503)
  assert.deepEqual(JSON.parse(response.body), { error: 'backend_unavailable' })
})

test('account access is disabled by default, including preflight', async () => {
  const handler = setup(() => {
    throw Error('must not reach origin')
  })
  for (const method of ['POST', 'OPTIONS']) {
    assert.equal((await handler(event('/v1/auth/google/start', method))).statusCode, 404)
  }
})
test('enabled account routes preserve bounded bodies and only necessary headers', async () => {
  const payload = JSON.stringify({ ticket: 'opaque-ticket', code_verifier: 'verifier' })
  const handler = setup(async (url, options) => {
    assert.equal(url.pathname, '/v1/auth/exchange')
    assert.equal(options.method, 'POST')
    assert.equal(options.body.toString(), payload)
    assert.equal(options.headers.authorization, 'Bearer token')
    assert.equal(options.headers['x-loro-device'], 'device')
    assert.equal(options.headers['idempotency-key'], 'request')
    assert.equal(options.headers.cookie, undefined)
    assert.equal(options.headers['x-forwarded-for'], undefined)
    return Response.json({ ok: true })
  }, true)
  assert.equal(
    (
      await handler({
        ...event('/v1/auth/exchange', 'POST'),
        body: Buffer.from(payload).toString('base64'),
        isBase64Encoded: true,
        headers: {
          Authorization: 'Bearer token',
          'x-loro-device': 'device',
          'idempotency-key': 'request',
          cookie: 'secret',
          'x-forwarded-for': 'spoofed',
        },
      })
    ).statusCode,
    200,
  )
})
test('OAuth callback preserves state and redirects without following it', async () => {
  const handler = setup(async (url, options) => {
    assert.equal(url.searchParams.get('state'), 'expected-state')
    assert.equal(url.searchParams.get('code'), 'google-code')
    assert.equal(url.searchParams.has('redirect_uri'), false)
    assert.equal(options.redirect, 'manual')
    return new Response(null, {
      status: 303,
      headers: {
        location: 'loro://account?ticket=opaque',
        'referrer-policy': 'no-referrer',
        'set-cookie': 'must-not-forward',
      },
    })
  }, true)
  const result = await handler({
    ...event('/v1/auth/google/callback'),
    queryStringParameters: {
      state: 'expected-state',
      code: 'google-code',
      redirect_uri: 'https://evil.test',
    },
  })
  assert.equal(result.statusCode, 303)
  assert.equal(result.headers.location, 'loro://account?ticket=opaque')
  assert.equal(result.headers['referrer-policy'], 'no-referrer')
  assert.equal(result.headers['set-cookie'], undefined)
})
test('preflight and throttling preserve origin decisions and Retry-After from API', async () => {
  const handler = setup(async (_, options) => {
    assert.equal(options.method, 'OPTIONS')
    assert.equal(options.headers.origin, 'https://app.example')
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': 'https://app.example',
        'access-control-allow-methods': 'GET,POST',
        vary: 'Origin',
      },
    })
  }, true)
  const result = await handler({
    ...event('/v1/auth/google/start', 'OPTIONS'),
    headers: { origin: 'https://app.example', 'access-control-request-method': 'POST' },
  })
  assert.equal(result.statusCode, 204)
  assert.equal(result.headers['access-control-allow-origin'], 'https://app.example')
  const limited = setup(
    async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }),
    true,
  )
  assert.equal((await limited(event('/v1/auth/google/start', 'POST'))).headers['retry-after'], '30')
})
test('enabled accounts still deny unsupported methods, paths and oversized requests', async () => {
  const handler = setup(() => {
    throw Error('must not reach origin')
  }, true)
  for (const [path, method] of [
    ['/v1/auth/google/start', 'GET'],
    ['/v1/auth/google/callback', 'POST'],
    ['/v1/auth/unknown/start', 'POST'],
    ['/v1/auth/exchange/', 'POST'],
    ['/v1/sync/pull', 'GET'],
    ['/v1/ai/scene', 'POST'],
  ])
    assert.equal((await handler(event(path, method))).statusCode, 404)
  assert.equal(
    (await handler({ ...event('/v1/sync/push', 'POST'), body: 'a'.repeat(1024 * 1024 + 1) }))
      .statusCode,
    413,
  )
})
test('unexpected upstream redirects never leak through ordinary account routes', async () => {
  const handler = setup(
    async () => new Response(null, { status: 302, headers: { location: 'https://other.test' } }),
    true,
  )
  const result = await handler(event('/v1/auth/google/start', 'POST'))
  assert.equal(result.statusCode, 502)
  assert.equal(result.headers.location, undefined)
})
