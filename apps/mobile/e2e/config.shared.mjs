/**
 * Settings both Playwright projects share.
 *
 * There are two configs — the dev server (`playwright.config.mjs`) and the production web
 * export (`playwright.config.production.mjs`) — and the whole point of the second is that
 * it differs from the first in ONE way: which bundle is being served. Anything else that
 * drifted between them would make a production-only failure ambiguous, so everything except
 * the server and the report folder lives here.
 */

import process from 'node:process'

export const isCI = process.env.CI !== undefined

/**
 * The learner's device, pinned.
 *
 * `timezoneId` is load-bearing rather than tidy: without it the suite runs in the runner's
 * zone — UTC in CI, whatever the laptop is set to locally — so no assertion about a local
 * day could be trusted, and the day-key logic behind plans 01 and 02 stayed untestable.
 * Madrid because it observes DST and is the zone `src/lib/clock.ts` uses to describe the bug
 * it fixes. `e2e/clock.ts` reads the zone back from the browser rather than repeating it.
 */
export const sharedUse = {
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'Europe/Madrid',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}

export const sharedTiming = {
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Serial, deliberately: the suite is well under its budget and a shared Expo dev server
  // is one fewer thing to reason about. Worth revisiting around 40 specs — and the budget
  // below is what will say when.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  /**
   * THE RUNTIME BUDGET, enforced rather than hoped for.
   *
   * `testing-strategy.md:218` puts E2E last in value per minute and plan 37's risks section
   * names suite runtime as the thing that erodes the fast feedback loop. A budget nobody
   * measures is a budget that is already gone, so this fails the run instead: eight minutes
   * against the ~2 the whole suite takes today, which leaves room to grow and still catches
   * a spec that hangs or quietly waits on a timeout.
   */
  globalTimeout: 8 * 60_000,
}
