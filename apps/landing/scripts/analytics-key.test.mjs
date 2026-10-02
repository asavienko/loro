import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { analyticsFrom, DEFAULT_HOST, withAnalytics } from './analytics-key.mjs'

const PAGE = [
  '<head>',
  '    <meta name="posthog-key" content="" />',
  '    <meta name="posthog-host" content="https://us.i.posthog.com" />',
  '</head>',
].join('\n')

await test('writes the key and host into the meta tags', () => {
  const out = withAnalytics(PAGE, { key: 'phc_abc123', host: 'https://eu.i.posthog.com' })
  assert.match(out, /<meta name="posthog-key" content="phc_abc123" \/>/)
  assert.match(out, /<meta name="posthog-host" content="https:\/\/eu.i.posthog.com" \/>/)
  assert.equal(withAnalytics(out, { key: 'phc_def' }), withAnalytics(PAGE, { key: 'phc_def' }))
})

await test('refuses a key or host that is not one, and a page without the tags', () => {
  assert.throws(() => withAnalytics(PAGE, { key: '' }), /phc_/)
  assert.throws(() => withAnalytics(PAGE, { key: 'phc_x"><script>' }), /phc_/)
  assert.throws(() => withAnalytics(PAGE, { key: 'phc_x', host: 'http://evil' }), /https origin/)
  assert.throws(() => withAnalytics('<head></head>', { key: 'phc_x' }), /meta tags/)
})

await test('the page in Git carries the tags empty, so a served copy without the key sends nothing', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /<meta name="posthog-key" content="" \/>/)
  assert.match(html, /<meta name="posthog-host" content="https:\/\/us.i.posthog.com" \/>/)
  assert.match(withAnalytics(html, { key: 'phc_abc' }), /content="phc_abc"/)
})

await test('takes the key from the shell first, then from apps/mobile/.env', () => {
  const dotenv =
    'EXPO_PUBLIC_POSTHOG_KEY=phc_file\nEXPO_PUBLIC_POSTHOG_HOST="https://eu.i.posthog.com"\n'
  assert.deepEqual(analyticsFrom({}, dotenv), { key: 'phc_file', host: 'https://eu.i.posthog.com' })
  assert.deepEqual(analyticsFrom({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_shell' }, ''), {
    key: 'phc_shell',
    host: DEFAULT_HOST,
  })
  assert.equal(analyticsFrom({}, ''), null)
})
