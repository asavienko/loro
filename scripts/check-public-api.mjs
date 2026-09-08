import assert from 'node:assert/strict'

const api = process.argv[2]
if (!api || !/^https:\/\/[a-z0-9.-]+\/v1$/.test(api))
  throw new Error('Usage: node scripts/check-public-api.mjs https://HOST/v1')
const results = []
async function get(path) {
  const response = await fetch(`${api}${path}`, {
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  })
  assert.equal(response.status, 200, path)
  const body = await response.json()
  results.push({ path, status: response.status })
  return body
}
const health = await get('/health/ready')
assert.equal(health.status, 'ok')
assert.equal(health.checks.content, 'ok')
assert.equal(health.checks.merge, 'ok')
assert.deepEqual((await get('/auth/providers')).providers, [])
for (const native of ['en', 'bg', 'ru']) {
  for (const target of ['es-ES', 'bg-BG', 'ru-RU']) {
    if (target.startsWith(native)) continue
    const query = `native=${native}&target=${target}`
    const manifest = await get(`/content/v2/manifest?${query}`)
    assert.equal(manifest.nativeLanguage, native)
    assert.equal(manifest.targetLocale, target)
    assert.equal(manifest.phraseCount, 31)
    const diff = await get(`/content/v2/diff?from=0&${query}`)
    assert.equal(diff.upserts.length, manifest.phraseCount)
    const pack = await get(`/content/v2/pack?id=${manifest.packs[0].id}&${query}`)
    assert.ok(pack.phrases.length > 0)
  }
}
for (const [path, method] of [
  ['/sync/pull', 'POST'],
  ['/sync/pull', 'GET'],
  ['/ai/scene', 'POST'],
  ['/auth/google/start', 'POST'],
  ['/health/ready', 'POST'],
]) {
  const response = await fetch(`${api}${path}`, { method, signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 404, `${method} ${path}`)
  results.push({ path, method, status: response.status })
}
console.log(JSON.stringify({ api, results }, null, 2))
