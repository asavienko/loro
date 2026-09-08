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
export const accountEnvironment = {
  EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_API_URL: 'https://auth.loro.test/v1',
}

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
  /**
   * Per test, not per suite — and three tests are whole-manifest SWEEPS.
   *
   * `accessibility.spec.ts`'s touch-target check and both `text-scale.spec.ts` scales walk every
   * state in `states.ts` on one page, so their cost is the manifest's, not a screen's. Raised from
   * 30 s when removing a phrase became undoable (`P2-13`): the undo toast is bottom-centred, so it
   * covers the bottom action bar, and each of the ten removals in `today · nothing in rotation`
   * waits for the previous toast to clear the `Remove` button it sits on — 2.6 s apiece, which put
   * a ~12 s sweep at ~38 s. Playwright waiting for a control to stop being obscured is correct
   * behaviour and worth keeping visible rather than forcing the click past it.
   *
   * `globalTimeout` below is the real budget guard; this only has to be larger than the slowest
   * single test.
   */
  timeout: 90_000,
  expect: { timeout: 5_000 },
  /**
   * THE RUNTIME BUDGET, enforced rather than hoped for.
   *
   * `testing-strategy.md:218` puts E2E last in value per minute and plan 37's risks section
   * names suite runtime as the thing that erodes the fast feedback loop. A budget nobody
   * measures is a budget that is already gone, so this fails the run instead: eight minutes
   * against the ~4 the whole suite takes today, which leaves room to grow and still catches
   * a spec that hangs or quietly waits on a timeout.
   */
  globalTimeout: 8 * 60_000,
}
