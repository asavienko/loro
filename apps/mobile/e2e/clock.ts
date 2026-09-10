/**
 * Fake-clock control for the web E2E suite.
 *
 * ── Why this exists ──
 * The two highest-consequence defects this app has fixed were both day-key bugs
 * (plans/01-fix-local-day-boundary.md, plans/02-fix-fabricated-streak.md), and neither
 * was reachable by a browser test: every spec ran at whatever instant the runner happened
 * to be at, so `localDay()` never changed and `streakDay()`'s four-hour grace window was
 * never crossed. `src/store/dayRollover.ts` documents the exact failure it defends against
 * and had no browser-level test behind any of its three call sites.
 *
 * See plans/51-extended-e2e-strategy.md §1.
 *
 * ── Instants are written in the LEARNER'S wall clock ──
 * `'2026-03-10T22:00'` means "22:00 as the learner's phone shows it", because that is the
 * frame both day keys are defined in (`packages/core/src/domain/calendar.ts`). The zone is
 * read back from the browser rather than hardcoded here, so it cannot drift from the
 * `timezoneId` the running project pinned, and a project that overrides the zone gets
 * correct instants for free.
 *
 * ── The clock is frozen while installed ──
 * `page.clock.install()` stops time: `setTimeout` fires only when a test advances it.
 * That is deliberate — it makes the toast timings in `src/ui/ToastHost.tsx` assertable
 * instead of racy — but it means a spec that waits for an app timeout must call
 * `runFor()`. Specs that do not need a clock should not install one.
 */

import { expect, type Page } from '@playwright/test'

/**
 * A learner-local wall-clock reading: `YYYY-MM-DDTHH:MM` or `YYYY-MM-DDTHH:MM:SS`.
 *
 * Deliberately not a `Date`. A `Date` built in the test process carries the *runner's*
 * timezone, so `new Date('2026-03-10T22:00')` would mean a different instant on a laptop
 * in Kyiv than on a CI runner in UTC — the exact confusion this module exists to remove.
 */
export type LocalInstant = string

/** Open morning wave in Europe/Madrid. After 19:00 the Start-the-wave control is locked. */
export const OPEN_WAVE_INSTANT: LocalInstant = '2026-04-06T10:00'

/** Same open-wave instant; name used by the phrase-songs frozen-clock helper. */
export const MANIFEST_CLOCK: LocalInstant = OPEN_WAVE_INSTANT

const preparedPages = new WeakSet<Page>()
const installedClocks = new WeakSet<Page>()

function markClockPrepared(page: Page): void {
  preparedPages.add(page)
}

/**
 * Install a frozen clock reading `local` in the browser's pinned timezone.
 *
 * Call this BEFORE the first navigation: `page.clock.install()` only patches contexts that
 * have not yet loaded the app.
 */
export async function atInstant(page: Page, local: LocalInstant): Promise<void> {
  await page.clock.install({ time: await epochFor(page, local) })
  markClockPrepared(page)
  installedClocks.add(page)
  await expectPageReads(page, local)
}

/** Pin an open-wave instant unless the spec already installed a clock. */
export async function ensureManifestClock(page: Page): Promise<void> {
  if (installedClocks.has(page)) return
  await atInstant(page, MANIFEST_CLOCK)
}

/**
 * Freeze `Date` at a learner-local instant without pausing timers.
 *
 * STATES-driven `enter()` needs an open-wave wall clock so Today is not next-wave locked,
 * but account provider discovery uses fetch + `setTimeout` abort. `clock.install()` pauses
 * those timers and leaves Google disabled.
 */
export async function fixWallClock(page: Page, local: LocalInstant): Promise<void> {
  await page.clock.setFixedTime(await epochFor(page, local))
  markClockPrepared(page)
  await expectPageReads(page, local)
}

/**
 * Specs that do not pick an instant still need an open wave. Day-boundary suites call
 * `atInstant` first, so this is a no-op on those pages.
 */
export async function ensureOpenWaveClock(page: Page): Promise<void> {
  if (preparedPages.has(page)) return
  await fixWallClock(page, OPEN_WAVE_INSTANT)
}

/**
 * Move the clock to another learner-local instant without running the timers in between.
 *
 * This is what a phone asleep across midnight actually does, and it is why the app listens
 * for the foreground rather than polling: nothing in the app would have run at 00:00.
 * Pair it with `returnToForeground()` to reach the rollover path.
 */
export async function jumpTo(page: Page, local: LocalInstant): Promise<void> {
  await page.clock.setSystemTime(await epochFor(page, local))
  await expectPageReads(page, local)
}

/**
 * Let the clock run, firing the app's own timers along the way.
 *
 * Use this for behaviour the app schedules itself — a toast auto-dismissing — rather than
 * for crossing a day boundary, which no timer in the app is waiting for.
 */
export async function runFor(page: Page, ms: number): Promise<void> {
  await page.clock.runFor(ms)
}

/**
 * What happens when the learner picks the phone back up.
 *
 * `AppState` on react-native-web is backed by the document's `visibilitychange` event and
 * reports `'active'` whenever `document.visibilityState` is not hidden
 * (`react-native-web/src/exports/AppState/index.js:56-80`). That listener is the one
 * `useDayRollover` subscribes to, so dispatching the event drives the real production path
 * rather than reaching into the store.
 *
 * The visibility state is asserted first: a Playwright page is always visible today, and
 * if that ever changes this fails loudly instead of quietly testing the background path.
 */
export async function returnToForeground(page: Page): Promise<void> {
  const state = await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    return document.visibilityState
  })
  expect(state, 'the page was not visible, so AppState reported background').toBe('visible')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The epoch instant at which the browser's timezone reads `local`.
 *
 * Solves `zoneReading(t) === local` for `t`. `zoneReading(t) = t + offset(t)`, so stepping
 * `t` by the residual converges in one pass away from a DST boundary and in two on one —
 * the second pass uses the offset actually in force at the corrected instant, which is the
 * whole difficulty of a transition day. `expectPageReads` catches the times that have no
 * solution (the hour a spring-forward skips) rather than letting them pass silently.
 */
async function epochFor(page: Page, local: LocalInstant): Promise<Date> {
  const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const target = Date.parse(`${withSeconds(local)}Z`)
  expect(Number.isNaN(target), `'${local}' is not a YYYY-MM-DDTHH:MM instant`).toBe(false)

  let at = target
  for (let pass = 0; pass < 2; pass += 1) {
    at += target - Date.parse(`${readInZone(new Date(at), timeZone)}Z`)
  }
  return new Date(at)
}

/** `at` as the zone's wall clock shows it, in the same `YYYY-MM-DDTHH:MM:SS` shape. */
function readInZone(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const of = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  return `${of('year')}-${of('month')}-${of('day')}T${of('hour')}:${of('minute')}:${of('second')}`
}

/**
 * Prove the browser agrees, so no spec can silently run at the wrong instant.
 *
 * This is the check that makes the conversion above trustworthy: it reads the page's own
 * `new Date()` local components — the same call `src/lib/clock.ts` makes — rather than
 * re-deriving the answer from the same arithmetic that produced it.
 */
async function expectPageReads(page: Page, local: LocalInstant): Promise<void> {
  const reading = await page.evaluate(() => {
    const pad = (n: number): string => String(n).padStart(2, '0')
    const d = new Date()
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  })
  expect(reading, 'the browser clock does not read the requested learner-local instant').toBe(
    withSeconds(local),
  )
}

function withSeconds(local: LocalInstant): string {
  return local.length === 16 ? `${local}:00` : local
}
