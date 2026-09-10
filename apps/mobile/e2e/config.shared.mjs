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
 * Expo's web bundler inlines `process.env.EXPO_PUBLIC_*` from `apps/mobile/.env`
 * (`http://localhost:3000/v1` in this checkout). Playwright still sets the fake
 * HTTPS host so a serializer/export that reads process.env stays off the LAN API.
 * `accountFlow` mocks both origins.
 */
export const accountEnvironment = {
  ...process.env,
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
  // Serial, deliberately: preserve deterministic browser/clock behavior across the shared
  // Expo dev server. The bounded suite budget includes the whole-state geometry sweeps.
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
   * Whole-manifest text-scale and touch-target sweeps set a five-minute budget as listen
   * companion states join the account and practice inventory.
   * Ordinary tests retain this timeout; `globalTimeout` bounds the complete run.
   */
  timeout: 90_000,
  expect: { timeout: 5_000 },
  /**
   * THE RUNTIME BUDGET, enforced rather than hoped for.
   *
   * `testing-strategy.md:218` puts E2E last in value per minute and plan 37's risks section
   * names suite runtime as the thing that erodes the fast feedback loop. A budget nobody
   * measures is a budget that is already gone. The integrated 155-test / 71-state suite
   * reached the old eight-minute cap after 149 passing tests, before its final text-scale
   * sweep. Eighteen minutes keeps the listen-export fixture states (AS-07) plus existing
   * sweeps while bounding the larger workload.
   */
  globalTimeout: 18 * 60_000,
}
