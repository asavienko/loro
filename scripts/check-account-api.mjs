/** F-01: live public-boundary probe. Never prints credentials, codes or OAuth state. */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'

const base = process.argv[2]?.replace(/\/$/, '')
assert.ok(base && new URL(base).protocol === 'https:', 'Pass the HTTPS API URL including /v1')
const request = (path, options = {}) =>
  fetch(base + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) })
const ready = await request('/health/ready')
assert.equal(ready.status, 200, 'durable readiness')
const health = await ready.json()
assert.equal(health.checks?.database, 'ok')
assert.equal(health.checks?.merge, 'ok')
const providers = await request('/auth/providers')
assert.ok((await providers.json()).providers.includes('google'), 'Google configured')
const verifier = randomBytes(32).toString('base64url')
const start = await request('/auth/google/start', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    redirect_uri: 'loro://account',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }),
})
assert.equal(start.status, 200, 'Google authorization start')
const flow = await start.json()
const authorization = new URL(flow.authorization_url)
assert.equal(authorization.origin, 'https://accounts.google.com')
assert.equal(authorization.searchParams.get('redirect_uri'), base + '/auth/google/callback')
assert.equal(authorization.searchParams.get('state'), flow.state)
assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
// Consume this synthetic attempt as a cancellation and verify the custom-scheme handoff.
const cancelled = await request(
  '/auth/google/callback?state=' + encodeURIComponent(flow.state) + '&error=access_denied',
)
assert.equal(cancelled.status, 303, 'callback redirect retained')
const location = new URL(cancelled.headers.get('location'))
assert.equal(location.protocol, 'loro:')
assert.equal(location.host, 'account')
assert.equal(location.searchParams.get('state'), flow.state)
assert.equal(location.searchParams.get('error'), 'sign_in_failed')
for (const path of ['/me', '/auth/me'])
  assert.equal((await request(path)).status, 401, 'anonymous account denied')
for (const path of ['/sync/pull', '/sync/push', '/sync/status']) {
  assert.equal(
    (
      await request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    401,
    'anonymous sync denied',
  )
}
assert.equal((await request('/ai/scene')).status, 404, 'AI stays private')
// F-04: the library through the gateway: Loro's pack for anyone, a learner's own things signed in.
const pack = await request('/library/pack?target=es-ES')
assert.equal(pack.status, 200, 'library pack')
assert.ok((await pack.json()).sets.length > 0, 'library seeded')
assert.equal((await request('/library/usage')).status, 401, 'anonymous library usage denied')
assert.equal((await request('/library/admin')).status, 404, 'unknown library route closed')
console.log(
  'Public durable readiness, Google start/cancel callback, the library pack and anonymous account/sync/library denial passed. Live Google consent and device session remain separate checks.',
)
