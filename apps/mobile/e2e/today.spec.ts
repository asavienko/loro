import { atInstant, jumpTo, returnToForeground, runFor } from './clock'
import { expect, onboard, test } from './fixtures'
import { START_WAVE, bankedRow, railCount, repsTodayRow, streakChip } from './states'

test(
  'LB-01..LB-08: Today exposes the finite set, the day, and every built destination',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await onboard(page)

    // The chrome, top to bottom: the spine names the place and opens the switcher, the root
    // header carries the date and the streak, and the rail sits on a hairline under it.
    await expect(page.getByRole('button', { name: /Today, open the menu/ })).toBeVisible()
    await expect(streakChip(page)).toHaveText('—')

    // The day, in order: three waves at the scheduler's own 24-hour times, exactly one of them
    // next, and the reps so far.
    await expect(page.getByText('Your day')).toBeVisible()
    const day = [
      { wave: 'Morning wave', time: '08:00' },
      { wave: 'Midday wave', time: '13:00' },
      { wave: 'Evening wave', time: '19:00' },
    ]
    for (const { wave, time } of day) {
      await expect(page.getByText(wave, { exact: true })).toBeVisible()
      await expect(page.getByText(time, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /wave\./ })).toHaveCount(1)
    await expect(repsTodayRow(page, 0)).toBeVisible()

    // Today's set: five rows, each openable, with the lock-in window on it.
    await expect(page.getByRole('button', { name: /0 percent automatic/ })).toHaveCount(5)
    await expect(page.getByText('0 of 5 locked in')).toBeVisible()
    await expect(page.getByText('day 1/4').first()).toBeVisible()

    // The tail of the rolling window, and the one filled control.
    await expect(bankedRow(page, 0)).toBeVisible()
    await expect(page.getByRole('button', { name: START_WAVE })).toBeEnabled()

    await railCount(page, 'Stream', 10).click()
    await expect(page).toHaveURL(/\/practice\/stream$/)
    await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page).toHaveURL(/\/progress$/)
    await expect(page.getByText('Phrase mastery')).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/add$/)
    await expect(page.getByRole('textbox', { name: 'Search phrases' })).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: START_WAVE }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/practice/refrain')
    await expect(page.getByRole('button', { name: 'Say it' })).toBeVisible()
  },
)

test('NAV-16: the spine reaches every built screen without going Back', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()

  // The place you are on is named, not offered — a switcher row that goes nowhere is a lie.
  await expect(page.getByText('Where to?')).toBeVisible()
  await expect(page.getByLabel("Today, you're here")).toBeVisible()

  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('button', { name: 'Stream' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Progress' }).click()
  await expect(page).toHaveURL(/\/progress$/)
})

test('NAV-16: the next wave is the one the clock is on', async ({ page }) => {
  // Fixed at an evening instant, so the day list and the CTA must both name the EVENING wave.
  // The readiness this replaced keyed off a position in an array, so the morning wave was the
  // ready one at every hour of the day.
  await atInstant(page, '2026-04-06T20:30')
  await onboard(page)

  await expect(
    page.getByRole('button', { name: 'Evening wave. Cold + perform · 5 phrases' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the evening wave' })).toBeEnabled()

  // A wave whose hour has gone by recedes, and says nothing about whether it was practised:
  // this learner has no recorded wave completions, so none may be claimed.
  await expect(page.getByText('Morning wave', { exact: true })).toBeVisible()
  await expect(page.getByText('done', { exact: true })).toHaveCount(0)
})

test('LB-01: Today updates the current wave while open and when returning to foreground', async ({
  page,
}) => {
  await atInstant(page, '2026-04-06T12:59:50')
  await onboard(page)
  await expect(page.getByRole('button', { name: 'Start the morning wave' })).toBeEnabled()
  await runFor(page, 10_000)
  await expect(page.getByRole('button', { name: 'Start the midday wave' })).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Midday wave. Re-rep, from memory · 5 phrases' }),
  ).toBeVisible()
  await jumpTo(page, '2026-04-06T20:30')
  await returnToForeground(page)
  await expect(page.getByRole('button', { name: 'Start the evening wave' })).toBeEnabled()
})

test('LB-01: Today rolls an open day at midnight without a foreground event', async ({ page }) => {
  await atInstant(page, '2026-04-06T23:59:50')
  await onboard(page)
  await runFor(page, 10_000)
  await expect(page.getByText('Tuesday, April 7')).toBeVisible()
  await expect(repsTodayRow(page, 0)).toBeVisible()
  // A fresh daily set exists at midnight, but morning has not opened yet. The old CTA let a
  // visible route parameter bypass the schedule; the displayed action now agrees with entry.
  await expect(page.getByRole('button', { name: 'Next wave starts at 08:00' })).toBeDisabled()
})

test('LB-03: direct Refrain entry cannot bypass a wave that has not opened', async ({ page }) => {
  await atInstant(page, '2026-04-06T07:59')
  await onboard(page)
  await page.goto('/practice/refrain?wave=morning')
  await expect(page.getByText('Next wave starts at 08:00')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to today' })).toBeVisible()
})
