/**
 * Learner journeys that take more than one day.
 *
 * ── Why these are clicked rather than injected ──
 * plans/51-extended-e2e-strategy.md §2 proposed a dev-only fixture loader so specs could
 * start from a deep state. Implementing it showed the premise was wrong in two ways:
 *
 *   1. The deep states that actually matter here are deep in TIME, not in size, and
 *      `e2e/clock.ts` already reaches them. A five-day streak is ~15 interactions; a
 *      graduation is 24 reps across four days. Both run in about a second, and clicking
 *      them exercises the real accumulation path instead of asserting that a fixture
 *      loaded — which is the only thing an injected state can prove.
 *   2. The one state clicking genuinely cannot reach — a 2 000-phrase library — is blocked
 *      by content, not by the harness: the catalog holds 31 phrases
 *      (`packages/content/es-ES/phrases.json`), so `largeFixture()` would inject rows with
 *      no catalog entry and render 2 000 blank lines. That waits on
 *      plans/36-content-scale-to-600.md.
 *
 * So no loader, and the e2e README's rule against injecting a state shape production does
 * not have stays intact rather than gaining an exception.
 *
 * ── What is still out of reach, and why ──
 *   • Scale — plans/36-content-scale-to-600.md, as above.
 *   • A trip mid-flight — the trip screens do not exist (plans/22-trip-arc-screens.md).
 *   • A due FSRS queue — `fsrsReview` is a four-interval stand-in and the review screen is
 *     unbuilt (plans/17, plans/24). Asserting a due date here would assert the stand-in.
 */

import type { Page } from '@playwright/test'
import { atInstant, jumpTo, returnToForeground } from './clock'
import { expect, onboard, test } from './fixtures'
import { click, doOneRep, lockIn, openProgress, statTile, streakChip, streakValue } from './states'

/** `LOCK_IN_DAYS_TO_GRADUATE` — four distinct lock-in days retires a phrase. */
const LOCK_IN_DAYS_TO_GRADUATE = 4

test('a streak climbs across five consecutive days', async ({ page }) => {
  await atInstant(page, '2026-04-06T09:00')
  await onboard(page)

  for (let day = 6; day <= 10; day += 1) {
    if (day > 6) await nextMorning(page, `2026-04-${String(day).padStart(2, '0')}T09:00`)
    await doOneRep(page)
    await expect(streakChip(page)).toHaveText(String(day - 5))
  }

  // The whole week row is lit, and the count is the real number of distinct days rather
  // than `i < streak` — the bug plans/02-fix-fabricated-streak.md removed.
  await openProgress(page)
  await expect(page.getByLabel('Last seven days: practised on 5 of them.')).toBeVisible()
  await expect(streakValue(page)).toHaveText('5')
  await expect(page.getByText('days 🔥')).toBeVisible()
})

test('a missed day resets the streak without saying so', async ({ page }) => {
  await atInstant(page, '2026-04-06T09:00')
  await onboard(page)
  await doOneRep(page)
  await nextMorning(page, '2026-04-07T09:00')
  await doOneRep(page)
  await expect(streakChip(page)).toHaveText('2')

  // Skip the 8th entirely and return on the 9th.
  await nextMorning(page, '2026-04-09T09:00')
  await doOneRep(page)

  await openProgress(page)
  await expect(streakValue(page)).toHaveText('1')
  // Three distinct days practised in the window, even though the run is one day long: the
  // history is a history, not a redraw of the streak.
  await expect(page.getByLabel('Last seven days: practised on 3 of them.')).toBeVisible()

  // Non-negotiable 3: no screen shames a missed day. The gap is drawn as an absence and
  // never named — no broken-streak notice, no apology, no comparison to what could have
  // been.
  const body = (await page.locator('body').innerText()).toLowerCase()
  for (const shame of [
    'broke',
    'broken',
    'lost',
    'missed',
    'oops',
    'sorry',
    'again',
    'back on track',
    "don't",
    'failed',
  ]) {
    expect(body, `Progress said "${shame}" after a missed day`).not.toContain(shame)
  }
})

test('four lock-in days graduate a phrase out of rotation', async ({ page }) => {
  await atInstant(page, '2026-04-06T09:00')
  await onboard(page)

  const retiring = await firstPhraseInSet(page)
  await expect(statTile(page, 'graduated', 0)).toBeVisible()

  for (let day = 0; day < LOCK_IN_DAYS_TO_GRADUATE; day += 1) {
    if (day > 0) await nextMorning(page, `2026-04-${String(6 + day).padStart(2, '0')}T09:00`)
    // A phrase mid-graduation is priority 1 in the next day's set, so the same phrase is
    // always Phrase 1 — deterministic without the spec knowing the selection rules.
    await expect(page.getByText(retiring, { exact: true })).toBeVisible()
    await click(page, 'Start the wave →')
    await lockIn(page)
    await page.goBack()
  }

  await expect(statTile(page, 'graduated', 1)).toBeVisible()

  // Still in TODAY's set, and that is the contract: the set is frozen once per day so a
  // learner can always finish what they were shown. A phrase vanishing from the screen the
  // moment it graduated would break "you always see today".
  await expect(page.getByText(retiring, { exact: true })).toBeVisible()

  // It leaves on the next roll, not before.
  await nextMorning(page, '2026-04-10T09:00')
  await expect(page.getByText(retiring, { exact: true })).toBeHidden()
  await expect(statTile(page, 'graduated', 1)).toBeVisible()

  // Retired means out of rotation, not deleted — the stream still holds all ten.
  await expect(statTile(page, 'in your stream', 10)).toBeVisible()
  await expect(page.getByRole('button', { name: /percent automatic/ })).toHaveCount(5)
})

test('a phrase practised for four non-consecutive days still graduates', async ({ page }) => {
  // `lockInDays` counts DISTINCT days, not a run, so a learner who skips a day does not
  // restart their progress towards graduation. Nothing else asserts that distinction.
  await atInstant(page, '2026-04-06T09:00')
  await onboard(page)
  const retiring = await firstPhraseInSet(page)

  for (const day of ['06', '08', '11', '12']) {
    if (day !== '06') await nextMorning(page, `2026-04-${day}T09:00`)
    await expect(page.getByText(retiring, { exact: true })).toBeVisible()
    await click(page, 'Start the wave →')
    await lockIn(page)
    await page.goBack()
  }

  await expect(statTile(page, 'graduated', 1)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────

/** Cross to a later day the way a phone does: the clock moved, then the app came back. */
async function nextMorning(page: Page, instant: string): Promise<void> {
  await jumpTo(page, instant)
  await returnToForeground(page)
}

/**
 * The Spanish of the first phrase in today's set, read from its accessible name.
 *
 * Read rather than hardcoded: which phrase the selection picks is the engine's business,
 * and a spec that named one would fail the day the catalog or the ranking changed for a
 * reason that has nothing to do with graduation.
 */
async function firstPhraseInSet(page: Page): Promise<string> {
  const label =
    (await page
      .getByRole('button', { name: /percent automatic/ })
      .first()
      .getAttribute('aria-label')) ?? ''
  const es = /^(.*)\.\s\d+ percent automatic\.$/.exec(label)?.[1]
  expect(es, `could not read the first phrase from '${label}'`).toBeTruthy()
  return es ?? ''
}
