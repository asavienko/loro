import { atInstant, jumpTo, returnToForeground, runFor } from './clock'
import { expect, onboard, test } from './fixtures'
import { repsTodayRow, startHardRefrain, startRefrain } from './helpers'

const reps = [
  { label: 'Say it', cue: 'Read it, then say it back', automaticity: 0 },
  { label: 'Chorus it', cue: 'Read aloud with a steady rhythm', automaticity: 17 },
  { label: 'Faster!', cue: 'Again, faster — keep the groove', automaticity: 33 },
  { label: 'Fill & say', cue: 'Fill the gap out loud', automaticity: 50 },
  { label: 'Respond', cue: 'Say the Spanish for the cue', automaticity: 67 },
  { label: 'Say it cold', cue: 'From memory — no model', automaticity: 83 },
] as const

test(
  'LB-20..LB-32: completes all 30 reps and propagates real results across screens',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await atInstant(page, '2026-05-04T10:00')
    await onboard(page)
    await startHardRefrain(page)

    for (let phrase = 1; phrase <= 5; phrase += 1) {
      await expect(page.getByText(`Phrase ${phrase} / 5`)).toBeVisible()
      await expect(page.getByTestId('warming-surface')).toBeVisible()
      await expect(page.getByTestId('beat-bars')).toBeVisible()

      for (const rep of reps) {
        await expect(page.getByText(rep.cue, { exact: true })).toBeVisible()
        await expect(
          page.locator('div[aria-label]').filter({
            has: page.getByText(rep.cue, { exact: true }),
          }),
        ).toBeVisible()
        await expect(
          page.locator('div[aria-label]').filter({
            has: page.getByText(rep.cue, { exact: true }),
          }),
        ).toHaveAttribute('aria-label', new RegExp(`${rep.automaticity} percent automatic`))
        await page.getByRole('button', { name: rep.label }).click()
        await expect(page.getByText('effort ↓', { exact: true })).toHaveCount(0)
        await expect(page.getByText('instant & smooth', { exact: true })).toHaveCount(0)
        await expect(page.getByText(/^\d+(\.\d+)?s$/)).toHaveCount(0)
      }

      await expect(page.locator('div[aria-label$="100 percent automatic."]')).toBeVisible()
      await expect(page.getByText('Locked in for today')).toBeVisible()
      await expect(page.getByText("Today's practice rounds are complete.")).toBeVisible()
      const nextLabel = phrase === 5 ? 'Finish the set →' : 'Next phrase →'
      await page.getByRole('button', { name: nextLabel }).click()
    }

    await expect(page.getByText('¡Hecho! Today is done')).toBeVisible()
    await expect(page.getByText("Today's set is warmed up")).toBeVisible()
    await expect(page.getByText('30', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.getByRole('button', { name: 'Back to today' }).click()
    await expect(page.getByText('5 of 5 locked in').filter({ visible: true })).toBeVisible()
    await expect(repsTodayRow(page, 30)).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByText('30', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByText('1', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByLabel(/Last seven days: practised on 1 of them/)).toBeVisible()
  },
)

test('opens a scheduled wave when its local time arrives on an already-open route', async ({
  page,
}) => {
  await atInstant(page, '2026-05-04T07:59')
  await onboard(page)
  await page.goto('/practice/refrain?wave=morning')
  await expect(page.getByText(/Next wave starts at/)).toBeVisible()

  await jumpTo(page, '2026-05-04T08:00')
  await returnToForeground(page)
  await expect(page.getByRole('button', { name: 'Say it', exact: true })).toBeVisible()
})

test('LB-27: manual confirmation never reports speech latency', async ({ page }) => {
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  await startRefrain(page)
  for (const [label, delay] of [
    ['Say it', 1500],
    ['Chorus it', 120],
    ['Faster!', 12400],
  ] as const) {
    await runFor(page, delay)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByText(/^(\d+ ms|\d+\.\ds)$/)).toHaveCount(0)
    await expect(page.getByText('effort ↓', { exact: true })).toHaveCount(0)
  }
})
