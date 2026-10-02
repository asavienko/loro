// Writes PostHog's project key and host into the page's <meta> tags (src/analytics.js reads them),
// for a copy of index.html about to be served. The key is public by design (ADR-0011) but, like the
// app's, lives in apps/mobile/.env and not in the tree: `node analytics-key.mjs <index.html>`
// rewrites that file from EXPO_PUBLIC_POSTHOG_KEY and EXPO_PUBLIC_POSTHOG_HOST in the shell or in
// that file, and fails when there is no key, so no deployment goes out silent by mistake.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const DEFAULT_HOST = 'https://us.i.posthog.com'
const KEY = 'EXPO_PUBLIC_POSTHOG_KEY'
const HOST = 'EXPO_PUBLIC_POSTHOG_HOST'

/**
 * The page with the key and host in its meta tags; the tags must be there (the page in Git carries
 * them empty), so a page without them is a mistake and not silently left as it is.
 * @param {string} html
 * @param {{ key: string, host?: string }} analytics
 */
export function withAnalytics(html, { key, host = DEFAULT_HOST }) {
  if (!/^phc_[A-Za-z0-9]+$/.test(key)) throw new Error('The PostHog key must look like phc_…')
  if (!/^https:\/\/[a-z0-9.-]+$/.test(host)) throw new Error(`Not an https origin: ${host}`)
  let found = 0
  const out = html.replace(
    /<meta name="posthog-(key|host)" content="[^"]*" \/>/g,
    /** @param {string} _match @param {string} which */
    (_match, which) => {
      found += 1
      return `<meta name="posthog-${which}" content="${which === 'key' ? key : host}" />`
    },
  )
  if (found !== 2) throw new Error('The page has no posthog-key and posthog-host meta tags')
  return out
}

/**
 * The key and host from the environment, else from apps/mobile/.env (the same two variables the
 * APK build reads from it, scripts/apk-environment.mjs); null without a key.
 * @param {Record<string, string | undefined>} env
 * @param {string} dotenv The contents of apps/mobile/.env, or '' when there is none.
 */
export function analyticsFrom(env, dotenv) {
  /** @type {Record<string, string>} */
  const found = {}
  for (const line of dotenv.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    const name = match?.[1]
    const value = match?.[2]?.replace(/^(['"])(.*)\1$/, '$2')
    if (name && value && (name === KEY || name === HOST)) found[name] = value
  }
  const key = given(env[KEY]) ?? found[KEY]
  if (!key) return null
  return { key, host: given(env[HOST]) ?? found[HOST] ?? DEFAULT_HOST }
}

/** A variable set to something, or undefined when unset or empty. @param {string | undefined} value */
const given = (value) => (value === '' ? undefined : value)

/** The repository's apps/mobile/.env as text, or '' when there is none. */
export async function readDotenv() {
  const path = fileURLToPath(new URL('../../mobile/.env', import.meta.url))
  return readFile(path, 'utf8').catch(() => '')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: node analytics-key.mjs <index.html>')
    process.exit(2)
  }
  const analytics = analyticsFrom(process.env, await readDotenv())
  if (!analytics) {
    console.error(
      'EXPO_PUBLIC_POSTHOG_KEY is not set (in the shell or apps/mobile/.env): the page would send no analytics or session replay. Set it to deploy.',
    )
    process.exit(1)
  }
  await writeFile(target, withAnalytics(await readFile(target, 'utf8'), analytics))
  console.log(`PostHog key written into ${target} (${analytics.host})`)
}
