/**
 * The interactions the coverage table never mentioned.
 *
 * Written after inventorying every interactive control in every state and diffing it
 * against what the specs actually reference. Most of the gap was content — individual
 * phrases matched by regex — but these were real: whole controls no spec had ever pressed,
 * and whole behaviours (a toast expiring, a browser Forward button) that only exist in the
 * gaps between screens.
 *
 * Three of them are only testable at all because of `e2e/clock.ts`: with a frozen clock the
 * toast timings are assertable instead of racy.
 *
 * See plans/51-extended-e2e-strategy.md §8.
 */

import { atInstant, runFor } from './clock'
import { expect, onboard, test } from './fixtures'
import {
  click,
  open,
  openFirstPhrase,
  repsTodayRow,
  startRefrain,
  todayMarker,
  trickyRow,
} from './helpers'

test('phrase feedback stays above the primary action and follows navigation', async ({ page }) => {
  await atInstant(page, '2026-07-30T10:00')
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('radio', { name: 'Difficult' }).click()
  const toast = page.getByRole('alert')
  await expect(toast).toBeVisible()
  const toastBounds = await toast.boundingBox()
  const actionBounds = await page.getByRole('button', { name: 'Practice now →' }).boundingBox()
  expect((toastBounds?.y ?? 0) + (toastBounds?.height ?? 0)).toBeLessThan(actionBounds?.y ?? 0)
  await page.getByRole('button', { name: 'Practice now →' }).click()
  await expect(page).toHaveURL(/\/practice\/refrain/)
})

test('a memory hook can be chosen and changed back', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)

  // Three suggestions, none chosen yet.
  const suggestions = page.getByRole('button', { name: /^Use hook: / })
  await expect(suggestions).toHaveCount(3)
  const chosen = await suggestions.first().getAttribute('aria-label')
  const hookText = (chosen ?? '').replace('Use hook: ', '')

  await suggestions.first().click()

  // The chosen hook replaces the list and says how to change it — the whole affordance.
  await expect(page.getByRole('button', { name: /^Memory hook: / })).toBeVisible()
  await expect(page.getByText('tap to change')).toBeVisible()
  await expect(page.getByText(hookText, { exact: true })).toBeVisible()
  await expect(suggestions).toHaveCount(0)

  await page.getByRole('button', { name: /^Memory hook: / }).click()
  await expect(suggestions).toHaveCount(3)
  await expect(page.getByText('tap to change')).toBeHidden()
})

test('a toast expires on the blueprint’s own timings', async ({ page }) => {
  // A frozen clock is what makes this assertable: with real time the toast is a race, and
  // the 1.7s/2.6s split (src/ui/ToastHost.tsx:21-22) could only be eyeballed.
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  await openFirstPhrase(page)

  // No Undo → 1.7s. Asserted either side of the boundary rather than to the millisecond:
  // the property worth locking is the duration the blueprint specifies, not the fake
  // clock's rounding.
  await page.getByRole('radio', { name: 'Difficult' }).click()
  const toast = page.getByRole('alert')
  await expect(page.getByTestId('arrival')).toBeVisible()
  await expect(toast).toContainText('repeats more, comes back sooner')
  await runFor(page, 1_500)
  await expect(toast).toBeVisible()
  await runFor(page, 400)
  await expect(toast).toBeHidden()
})

test('an undoable toast lasts longer, and the add survives it expiring', async ({ page }) => {
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  await open(page, 'Add')
  await page.getByRole('button', { name: /¿Tienen una mesa para dos/ }).click()
  await click(page, 'Add to my stream')

  // With Undo → 2.6s, so it is still there at the point the plain one would have gone.
  const toast = page.getByRole('alert')
  await expect(toast).toContainText('Added — here are more like it')
  await runFor(page, 1_800)
  await expect(toast).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()

  await runFor(page, 900)
  await expect(toast).toBeHidden()
  // The undo window closing must not undo anything: the phrase stays added.
  await expect(page.getByText('11 in stream')).toBeVisible()
})

test('Today’s empty state offers a way out and disables the wave', async ({ page }) => {
  await onboard(page)
  for (let phrase = 10; phrase > 0; phrase -= 1) {
    await openFirstPhrase(page)
    await click(page, 'Remove')
    await expect(page).toHaveURL(/\/$/)
  }

  // The primary action is disabled and RELABELLED — it says what to do instead of failing.
  const primary = page.getByRole('button', { name: 'Add phrases to begin' })
  await expect(primary).toBeVisible()
  await expect(primary).toBeDisabled()
  await expect(page.getByText(/Nothing in rotation yet/)).toBeVisible()
  await expect(page.getByText('0 of 0 locked in')).toBeVisible()

  // The day's next wave is not a second way in while the primary says there is nothing to do:
  // one screen cannot both offer and refuse the same wave.
  await expect(page.getByRole('button', { name: /wave\./ })).toHaveCount(0)

  // And the set's own button is the working route out. `exact` because the disabled
  // primary above is labelled "Add phrases to begin" and would match a substring.
  await page.getByRole('button', { name: 'Add phrases', exact: true }).click()
  await expect(page).toHaveURL(/\/add$/)
  await expect(page.getByText('0 in stream')).toBeVisible()
})

test('browser Back and Forward keep the learner’s state', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('checkbox', { name: 'Very useful' }).click()
  await expect(page.getByRole('checkbox', { name: 'Very useful' })).toBeChecked()

  await page.goBack()
  await expect(todayMarker(page)).toBeVisible()

  // Forward is the half nothing tested. History navigation must not remount a fresh screen
  // that has forgotten the tag — the store outlives the route.
  await page.goForward()
  await expect(page).toHaveURL(/\/phrase\//)
  await expect(page.getByRole('checkbox', { name: 'Very useful' })).toBeChecked()

  // KNOWN GAP, recorded rather than worked around: after a Forward there is no in-app back
  // control. The stack has no anchor, so expo-router restores the route with no parent to
  // return to — the same root cause as plans/46-navigation-system.md's first defect, where
  // `unstable_settings` sits in a screen file that expo-router only reads from a layout.
  // Asserting it means plan 46's fix will visibly flip this line rather than pass silently.
  await expect(page.getByRole('link', { name: /back/i })).toHaveCount(0)

  // The learner is not stranded in the product sense — the tab buttons still work — but
  // getting to Progress needs the browser, which is the gap.
  await page.goBack()
  await open(page, 'Progress')
  await expect(trickyRow(page, 'Very useful', 1)).toBeVisible()
})

test('pressing a rep twice counts twice, and never lands between modes', async ({ page }) => {
  await atInstant(page, '2026-04-06T10:00')
  await onboard(page)
  await startRefrain(page)

  // Double-pressing a rep button is the most likely accidental input in the hero loop: the
  // cue changes under the finger. Two presses must be two reps and land on mode 3, not on a
  // half-applied state.
  await page.getByRole('button', { name: 'Say it' }).dblclick()
  await expect(page.getByText('Again, faster — keep the groove')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Automaticity' })).toHaveAttribute(
    'aria-valuenow',
    '33',
  )

  await page.getByRole('button', { name: 'Leave practice', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Pause the wave', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
  await expect(repsTodayRow(page, 2)).toBeVisible()
})

test('a cold deep link to a practice route does not strand the learner', async ({ page }) => {
  // A notification or a widget will open these directly, and plan 46 owns the route map.
  // This records what happens today so a change to it is deliberate: the store is in memory,
  // so a fresh load has no learner and no phrases.
  await page.goto('/practice/refrain')

  // Whatever it shows, it must not be a blank screen and must offer a way forward.
  await expect(page.locator('body')).not.toHaveText('')
  const escape = page.getByRole('button', { name: /Add phrases|Back to today/ })
  const redirected = page.url().includes('/onboarding')
  expect(
    redirected || (await escape.count()) > 0,
    'a cold deep link left the learner with no route out',
  ).toBe(true)
})
