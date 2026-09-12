/**
 * The day boundary, end to end.
 *
 * These are the tests the suite could not express before `e2e/clock.ts`: the app reads the
 * real clock, so every other spec runs on one arbitrary day and never crosses midnight.
 * Both bugs this repo has already fixed at the hero screen were day-key bugs
 * (plans/01-fix-local-day-boundary.md, plans/02-fix-fabricated-streak.md), and
 * `src/store/dayRollover.ts` names the three places it now defends — none of which had a
 * browser-level test.
 *
 * The two keys are NOT interchangeable, which is what most of this file is about:
 *   • `localDay()`  — midnight to midnight. Today's frozen Refrain set rolls here.
 *   • `streakDay()` — plus four hours, so 01:30 still belongs to the evening before.
 *
 * All times below are the LEARNER'S wall clock in the project's pinned zone. 2026-03-10 is
 * a Tuesday; 2026-03-29 is the Sunday Madrid springs forward, a 23-hour day.
 */

import type { Locator, Page } from '@playwright/test'
import { atInstant, jumpTo, returnToForeground } from './clock'
import { expect, onboard, test } from './fixtures'
import {
  backToToday,
  doOneRep,
  lockIn,
  openProgress,
  repsTodayRow,
  startWave,
  streakValue,
} from './helpers'

test('the date line names the learner’s day, not the runner’s', async ({ page }) => {
  await atInstant(page, '2026-03-10T22:00')
  await onboard(page)

  // The v1.1 root header prints the real date, in the device's own locale — pinned to en-US
  // and Europe/Madrid for the suite (`config.shared.mjs`).
  await expect(page.getByText('Tuesday, March 10')).toBeVisible()
})

test('a new day clears yesterday’s reps and lock-ins from Today', async ({ page }) => {
  await atInstant(page, '2026-03-10T22:00')
  await onboard(page)

  await startWave(page)
  await lockIn(page)
  await page.goBack()
  await expect(page.getByText('1 of 5 locked in')).toBeVisible()
  await expect(repsTodayRow(page, 6)).toBeVisible()

  // A phone asleep across midnight: no timer fired, the learner just picked it up again.
  await jumpTo(page, '2026-03-11T09:00')
  await returnToForeground(page)

  // Nothing has been practised today, so every number on the screen must say so —
  // non-negotiable 2. Yesterday's `automaticity` and `repsToday` are still on the row.
  await expect(page.getByText('Wednesday, March 11')).toBeVisible()
  await expect(page.getByText('0 of 5 locked in')).toBeVisible()
  await expect(repsTodayRow(page, 0)).toBeVisible()
  await expect(page.getByText('Locked', { exact: true })).toHaveCount(0)
})

test('entering the Refrain on a new day rolls the set without a foreground event', async ({
  page,
}) => {
  await atInstant(page, '2026-03-10T22:00')
  await onboard(page)
  await startWave(page)
  await lockIn(page)
  await page.goBack()

  // Deliberately no `returnToForeground` — this covers the second of the three call sites
  // in `src/store/dayRollover.ts`, the one on entry to the Refrain.
  await jumpTo(page, '2026-03-11T09:00')
  await startWave(page)

  await expect(page.getByText('Phrase 1 / 5')).toBeVisible()
  await expect(page.getByText('Locked in for today')).toBeHidden()
  await expect(page.getByRole('progressbar', { name: 'Automaticity' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
})

test('the streak grace window keeps the prior evening practice before the next wave opens', async ({
  page,
}) => {
  await atInstant(page, '2026-03-10T23:50')
  await onboard(page)
  await doOneRep(page)

  await openProgress(page)
  await expect(page.getByLabel('Last seven days: practised on 1 of them.')).toBeVisible()
  await expect(streakValue(page)).toHaveText('1')
  await backToToday(page)

  // 01:30 is inside the four-hour grace, so this rep belongs to the 10th — the same streak
  // day as the one before it. A second distinct day here would mean the grace window was
  // not applied, and the learner would be shown a two-day streak they did not earn. Practice
  // stays open; the wave is not a lock.
  await jumpTo(page, '2026-03-11T01:30')
  await returnToForeground(page)
  await expect(page.getByRole('button', { name: 'Start the morning wave' })).toBeEnabled()

  await openProgress(page)
  await expect(page.getByLabel('Last seven days: practised on 1 of them.')).toBeVisible()
  await expect(streakValue(page)).toHaveText('1')
})

test('a session past the grace window starts a second streak day', async ({ page }) => {
  await atInstant(page, '2026-03-10T23:50')
  await onboard(page)
  await doOneRep(page)

  // The grace window closes at 04:00, so 09:00 is unambiguously the 11th. This is the other
  // side of the boundary asserted above; together they pin it rather than assuming whichever
  // direction happens to pass.
  await jumpTo(page, '2026-03-11T09:00')
  await returnToForeground(page)
  await doOneRep(page)

  await openProgress(page)
  await expect(page.getByLabel('Last seven days: practised on 2 of them.')).toBeVisible()
  await expect(streakValue(page)).toHaveText('2')
})

test('an earned milestone survives the next morning’s first rep', async ({ page }) => {
  await atInstant(page, '2026-03-10T22:00')
  await onboard(page)
  await startWave(page)
  await lockIn(page)
  await page.goBack()

  await openProgress(page)
  await expect(milestone(page, 'First locked in')).toContainText('✓')
  await backToToday(page)

  // Tomorrow's first rep rewrites the stored `automaticity` DOWNWARD, from 100 to 17. A
  // milestone keyed on that signal un-earns itself here; one keyed on `lockInDays`, which
  // only ever climbs, does not. Nothing the learner has earned may disappear.
  await jumpTo(page, '2026-03-11T09:00')
  await returnToForeground(page)
  await doOneRep(page)

  await openProgress(page)
  await expect(milestone(page, 'First locked in')).toContainText('✓')
})

test('the streak survives the spring-forward day', async ({ page }) => {
  // Madrid moves 02:00 → 03:00 on the 29th, so the 28th→29th gap is 23 hours of elapsed
  // time and one calendar day. A streak measured in elapsed hours breaks here; one measured
  // in calendar days does not (`packages/core/src/domain/calendar.ts`).
  await atInstant(page, '2026-03-28T22:00')
  await onboard(page)
  await doOneRep(page)

  await jumpTo(page, '2026-03-29T12:00')
  await returnToForeground(page)
  await doOneRep(page)

  await openProgress(page)
  await expect(page.getByLabel('Last seven days: practised on 2 of them.')).toBeVisible()
  await expect(streakValue(page)).toHaveText('2')

  // Seven cells, one per local date. A week built by subtracting 24 hours would land twice
  // on the same date across the transition and draw six.
  const initials = await weekdayInitials(page)
  expect(initials, `the week row drew ${initials.length} days: ${initials.join('')}`).toEqual([
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
    'S',
  ])
})

// ─────────────────────────────────────────────────────────────────────────────
// NOT COVERED HERE, and why
//
// A cold launch on a new day — the third `dayRollover.ts` call site, `ensure()` on mount —
// needs the app to survive a reload. The store is in memory today, so `page.reload()`
// returns a first-run app and redirects to onboarding rather than a launched-on-a-new-day
// app. It becomes testable with plans/10-sqlite-persistence-and-outbox.md, and faking it
// here would assert a state shape production does not have.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A milestone row on Progress, addressed by its title.
 *
 * The `✓` renders only for an earned milestone (`app/progress.tsx`); the rest of the
 * earned/unearned distinction is colour and opacity, which is not assertable and not
 * available to a learner who cannot see it either.
 */
function milestone(page: Page, title: string): Locator {
  return page.getByText(title, { exact: true }).locator('../..')
}

/** The seven weekday initials in the Progress week row, oldest first. */
async function weekdayInitials(page: Page): Promise<string[]> {
  const cells = await page.getByLabel(/^Last seven days/).allInnerTexts()
  return cells
    .join('\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length === 1 && s !== '🔥')
}
