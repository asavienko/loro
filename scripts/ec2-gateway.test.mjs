import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Exercise the exact inline Lambda source deployed by CloudFormation.
const template = readFileSync(new URL('../infra/ec2/https.yaml', import.meta.url), 'utf8')
const source = template.match(/ZipFile: \|\n([\s\S]*?)\n  Logs:/)[1]
function setup(fetch) {
  const exports = {}
  runInNewContext(source, {
    exports,
    fetch,
    URL,
    AbortSignal,
    process: {
      env: { ORIGIN: 'http://172.31.21.138:8080' },
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
    assert.equal(options.headers, undefined)
    assert.equal(options.redirect, 'error')
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
