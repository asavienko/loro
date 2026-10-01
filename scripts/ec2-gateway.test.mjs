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
const fromLearner = (path, method = 'GET', extra = {}) => ({
  rawPath: path,
  requestContext: { http: { method, sourceIp: '203.0.113.7' } },
  ...extra,
})
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

// F-04: the library routes the app calls.
test('the library is closed while account access is disabled', async () => {
  const handler = setup(() => {
    throw Error('must not reach origin')
  })
  for (const [path, method] of [
    ['/v1/library/pack', 'GET'],
    ['/v1/library/progress', 'POST'],
    ['/v1/library/sets/set-u-1a2b3c', 'DELETE'],
    ['/v1/library/pack', 'OPTIONS'],
  ])
    assert.equal((await handler(event(path, method))).statusCode, 404)
})
test('a library read forwards its query keys, bearer and validator, and keeps the API caching', async () => {
  const handler = setup(async (url, options) => {
    assert.equal(url.pathname, '/v1/library/community')
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      target: 'es-ES',
      kind: 'albums',
      q: 'café con leche',
      sort: 'popular',
    })
    assert.equal(options.method, 'GET')
    // Copied: the handler's object belongs to the VM context's realm.
    assert.deepEqual(
      { ...options.headers },
      {
        authorization: 'Bearer token',
        'if-none-match': 'W/"abc"',
        'x-loro-source-ip': '203.0.113.7',
      },
    )
    return Response.json(
      { albums: [{ title: 'Песни' }] },
      { headers: { 'cache-control': 'private, max-age=60', etag: 'W/"def"' } },
    )
  }, true)
  const result = await handler(
    fromLearner('/v1/library/community', 'GET', {
      queryStringParameters: {
        target: 'es-ES',
        kind: 'albums',
        q: 'café con leche',
        sort: 'popular',
        url: 'http://attacker.test',
      },
      headers: {
        Authorization: 'Bearer token',
        'If-None-Match': 'W/"abc"',
        cookie: 'private',
        'x-real-ip': '198.51.100.1',
        'x-loro-source-ip': '198.51.100.2',
      },
    }),
  )
  assert.equal(result.statusCode, 200)
  assert.equal(result.isBase64Encoded, false)
  assert.equal(result.headers['cache-control'], 'private, max-age=60')
  assert.equal(result.headers.etag, 'W/"def"')
  assert.deepEqual(JSON.parse(result.body), { albums: [{ title: 'Песни' }] })
})
test('a clip answers HEAD, and an unchanged reply passes as 304', async () => {
  const clip = '/v1/library/speech/0123456789abcdef0123456789abcdef.mp3'
  const handler = setup(async (url, options) => {
    assert.equal(url.pathname, clip)
    assert.equal(url.searchParams.get('v'), '1a2b3c4d')
    if (options.method === 'HEAD')
      return new Response(null, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    return new Response(null, { status: 304, headers: { etag: 'W/"same"' } })
  }, true)
  const head = await handler(
    fromLearner(clip, 'HEAD', { queryStringParameters: { v: '1a2b3c4d' } }),
  )
  assert.equal(head.statusCode, 200)
  assert.equal(head.body, '')
  assert.equal(head.headers['content-type'], 'audio/mpeg')
  assert.equal(head.headers['cache-control'], 'public, max-age=31536000, immutable')
  const unchanged = await handler(
    fromLearner(clip, 'GET', { queryStringParameters: { v: '1a2b3c4d' } }),
  )
  assert.equal(unchanged.statusCode, 304)
  assert.equal(unchanged.headers.etag, 'W/"same"')
})
test('song audio round-trips byte for byte as base64, with its range', async () => {
  const audio = Buffer.alloc(300_000)
  for (let i = 0; i < audio.length; i++) audio[i] = (i * 7919) % 256
  const handler = setup(async (url, options) => {
    assert.equal(url.pathname, '/v1/library/songs/song-1a2b3c4d5e6f/audio')
    assert.equal(url.searchParams.get('exp'), '1790000000000')
    assert.equal(url.searchParams.get('sig'), 'c2lnbmF0dXJl')
    assert.equal(options.headers.range, 'bytes=0-')
    return new Response(audio, {
      status: 206,
      headers: {
        'content-type': 'audio/wav',
        'content-range': `bytes 0-${audio.length - 1}/${audio.length}`,
        'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=3600',
        'content-length': String(audio.length),
      },
    })
  }, true)
  const result = await handler(
    fromLearner('/v1/library/songs/song-1a2b3c4d5e6f/audio', 'GET', {
      queryStringParameters: { exp: '1790000000000', sig: 'c2lnbmF0dXJl' },
      headers: { range: 'bytes=0-' },
    }),
  )
  assert.equal(result.statusCode, 206)
  assert.equal(result.isBase64Encoded, true)
  assert.ok(Buffer.from(result.body, 'base64').equals(audio))
  assert.equal(result.headers['content-range'], `bytes 0-${audio.length - 1}/${audio.length}`)
  assert.equal(result.headers['accept-ranges'], 'bytes')
  assert.equal(result.headers['content-type'], 'audio/wav')
  assert.equal(result.headers['cache-control'], 'private, max-age=3600')
})
test('a cover keeps its content security policy; an oversized reply is refused, not cut', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const handler = setup(async (url) => {
    if (url.pathname.endsWith('.svg'))
      return new Response(svg, {
        headers: {
          'content-type': 'image/svg+xml',
          'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
          'x-content-type-options': 'nosniff',
        },
      })
    return new Response(Buffer.alloc(4_600_000), { headers: { 'content-type': 'audio/wav' } })
  }, true)
  const cover = await handler(fromLearner('/v1/library/covers/cover-1a2b3c4d5e6f.svg'))
  assert.equal(cover.statusCode, 200)
  assert.equal(Buffer.from(cover.body, 'base64').toString(), svg)
  assert.equal(
    cover.headers['content-security-policy'],
    "default-src 'none'; style-src 'unsafe-inline'",
  )
  assert.equal(cover.headers['x-content-type-options'], 'nosniff')
  const tooLarge = await handler(fromLearner('/v1/library/songs/song-1a2b3c4d5e6f/audio'))
  assert.equal(tooLarge.statusCode, 502)
  assert.deepEqual(JSON.parse(tooLarge.body), { error: 'response_too_large' })
})
test('a 3 MB progress write reaches the API whole; over 4 MiB is refused at the gateway', async () => {
  const progress = JSON.stringify({ revision: 3, state: 'x'.repeat(3 * 1024 * 1024) })
  const handler = setup(async (url, options) => {
    assert.equal(url.pathname, '/v1/library/progress')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['content-type'], 'application/json')
    assert.ok(options.body.equals(Buffer.from(progress)))
    return Response.json({ revision: 4 })
  }, true)
  const written = await handler(
    fromLearner('/v1/library/progress', 'POST', {
      body: progress,
      headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    }),
  )
  assert.equal(written.statusCode, 200)
  assert.deepEqual(JSON.parse(written.body), { revision: 4 })
  const oversized = await handler(
    fromLearner('/v1/library/progress', 'POST', { body: 'x'.repeat(4 * 1024 * 1024 + 1) }),
  )
  assert.equal(oversized.statusCode, 413)
})
test('a delete names its item, and limits pass Retry-After through', async () => {
  const seen = []
  const handler = setup(async (url, options) => {
    seen.push(`${options.method} ${url.pathname}`)
    assert.equal(options.body, undefined)
    if (url.pathname.startsWith('/v1/library/saves/'))
      return new Response('{"code":"RATE_LIMITED"}', {
        status: 429,
        headers: { 'content-type': 'application/problem+json', 'retry-after': '30' },
      })
    return new Response(null, { status: 204 })
  }, true)
  const deleted = await handler(fromLearner('/v1/library/sets/set-u-1a2b3c4d5e6f', 'DELETE'))
  assert.equal(deleted.statusCode, 204)
  assert.equal(deleted.body, '')
  const limited = await handler(fromLearner('/v1/library/saves/album/album-u-1a2b3c', 'DELETE'))
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.headers['retry-after'], '30')
  assert.equal(limited.isBase64Encoded, false)
  assert.deepEqual(seen, [
    'DELETE /v1/library/sets/set-u-1a2b3c4d5e6f',
    'DELETE /v1/library/saves/album/album-u-1a2b3c',
  ])
})
test('every library route the app calls is open, by its own methods only', async () => {
  const id = 'set-u-1a2b3c4d5e6f'
  const open = [
    ...[
      'pack',
      'community',
      'languages',
      'usage',
      'profile',
      'progress',
      `sets/${id}`,
      `sets/${id}/songs`,
      `sets/${id}/more`,
      'albums/album-loro-es',
      'albums/album-loro-es/more',
      'shared/abcd234567',
      'songs/song-loro-cafe',
      'songs/song-loro-cafe/audio',
      'covers/cover-loro-es-r6.svg',
      // Plan 111: where a cover being drawn stands.
      'covers/cover-1a2b3c4d5e6f.json',
      // Plan 111: a deck written in the background.
      'decks/deck-1a2b3c4d5e6f',
      'speech/0123456789abcdef0123456789abcdef.mp3',
    ].flatMap((p) => [
      ['GET', p],
      ['HEAD', p],
    ]),
    ...[
      'profile',
      'progress',
      'sets',
      `sets/${id}`,
      `sets/${id}/phrases/cafe-01`,
      'phrases',
      'albums',
      'albums/album-u-1a2b3c',
      'saves',
      'reports',
      'generate/phrases',
      'generate/notes',
      'generate/cover',
      'generate/song',
      'decks',
      'songs/song-1a2b3c/retry',
      'me/delete',
      'me/delete-account',
    ].map((p) => ['POST', p]),
    ...[
      `sets/${id}`,
      'phrases/mine-p-1a2b3c',
      'albums/album-u-1a2b3c',
      'songs/song-1a2b3c',
      `saves/set/${id}`,
      'saves/album/album-u-1a2b3c',
    ].map((p) => ['DELETE', p]),
    ['OPTIONS', 'progress'],
  ]
  const handler = setup(async () => new Response(null, { status: 204 }), true)
  for (const [method, path] of open)
    assert.equal(
      (await handler(fromLearner(`/v1/library/${path}`, method))).statusCode,
      204,
      `${method} ${path}`,
    )
})
test('an unknown library path or method still gets 404 without reaching the API', async () => {
  const handler = setup(() => {
    throw Error('must not reach origin')
  }, true)
  for (const [method, path] of [
    ['GET', '/v1/library/'],
    ['GET', '/v1/library/admin'],
    ['GET', '/v1/library/pack/'],
    ['GET', '/v1/library/sets/../../health'],
    ['GET', '/v1/library/sets/%2e%2e'],
    ['GET', '/v1/library/sets/SET-U-1'],
    ['GET', '/v1/library/sets/set-u-1/phrases'],
    ['GET', '/v1/library/speech/0123.mp3'],
    ['GET', '/v1/library/covers/cover-1.png'],
    ['POST', '/v1/library/covers/cover-1a2b3c.json'],
    ['DELETE', '/v1/library/decks/deck-1a2b3c'],
    ['POST', '/v1/library/decks/deck-1a2b3c'],
    ['GET', '/v1/library/shared/abc'],
    ['PUT', '/v1/library/progress'],
    ['PATCH', '/v1/library/sets/set-u-1a2b3c'],
    ['DELETE', '/v1/library/pack'],
    ['DELETE', '/v1/library/saves/song/song-1a2b3c'],
    ['POST', '/v1/library/covers/cover-1a2b3c.svg'],
    ['POST', '/v1/library/generate/everything'],
    ['OPTIONS', '/v1/library/unknown'],
    ['GET', '/v1/libraryx/pack'],
  ])
    assert.equal((await handler(fromLearner(path, method))).statusCode, 404, `${method} ${path}`)
})
test('sign-in carries the caller address; public reads and spoofed addresses do not', async () => {
  const seen = []
  const handler = setup(async (url, options) => {
    seen.push([url.pathname, options.headers['x-loro-source-ip']])
    return Response.json({})
  }, true)
  await handler(
    fromLearner('/v1/auth/magic-link', 'POST', {
      body: '{}',
      headers: { 'x-loro-source-ip': '198.51.100.2' },
    }),
  )
  await handler(fromLearner('/v1/health/ready'))
  await handler({
    ...event('/v1/library/pack'),
    requestContext: { http: { method: 'GET', sourceIp: 'not an address' } },
  })
  assert.deepEqual(seen, [
    ['/v1/auth/magic-link', '203.0.113.7'],
    ['/v1/health/ready', undefined],
    ['/v1/library/pack', undefined],
  ])
})
