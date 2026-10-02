// Product analytics and session replay for the page (ADR-0011): PostHog, the app's own project.
// Loaded only when the page carries a project key in <meta name="posthog-key">: the deploy writes
// it in (scripts/analytics-key.mjs), the folder in Git has none, so a copy served as it is sends
// nothing. Page views, clicks and the recording of the visit are PostHog's own; what the page
// itself has to say (a download, the film played, a course picked) goes through `track`.

/**
 * @typedef {Record<string, string | number | boolean | null>} Properties
 * @typedef {{
 *   init(key: string, config: Record<string, unknown>): void
 *   capture(name: string, properties?: Properties): void
 * }} PostHogClient
 */

const key = meta('posthog-key')
const host = meta('posthog-host') || 'https://us.i.posthog.com'

/** @type {PostHogClient | null} */
let client = null
/** Recorded before PostHog's script arrived; sent once it has. */
/** @type {{ name: string, properties: Properties }[]} */
let waiting = []

/** @param {string} name */
function meta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')?.trim() ?? ''
}

/**
 * PostHog serves its API from `https://us.i.posthog.com` and its scripts from
 * `https://us-assets.i.posthog.com` (the EU host alike); any other host serves both itself.
 * @param {string} apiHost
 */
export function assetsHost(apiHost) {
  const region = /^https:\/\/([a-z0-9-]+)\.i\.posthog\.com$/.exec(apiHost)?.[1]
  return region ? `https://${region}-assets.i.posthog.com` : apiHost
}

/** Loads PostHog when the page has a key; the page's Content-Security-Policy names both hosts. */
export function setUpAnalytics() {
  if (!key) return
  const script = document.createElement('script')
  script.src = `${assetsHost(host)}/static/array.js`
  script.async = true
  script.addEventListener('load', () => {
    const posthog = /** @type {{ posthog?: PostHogClient }} */ (/** @type {unknown} */ (window))
      .posthog
    if (!posthog) return
    posthog.init(key, {
      api_host: host,
      // PostHog's current defaults: a page view on each history change, people only once
      // identified. Nobody signs in here, so visits stay anonymous events and no person is kept.
      defaults: '2025-05-24',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      // The visit as the visitor saw it, with the console and each request's timing (never its
      // body); there is no input on the page to mask.
      session_recording: { maskAllInputs: true },
      capture_performance: true,
    })
    client = posthog
    for (const event of waiting) client.capture(event.name, event.properties)
    waiting = []
  })
  document.head.append(script)
}

/**
 * Records something the page did: `track('download_clicked', { build: 'e30a848', where: 'hero' })`.
 * @param {string} name
 * @param {Properties} [properties]
 */
export function track(name, properties = {}) {
  if (!key) return
  if (client) client.capture(name, properties)
  else waiting.push({ name, properties })
}
