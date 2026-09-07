import { atInstant, runFor } from './clock'
import { expect, onboard, test } from './fixtures'
import { repsTodayRow, startWave } from './states'

const reps = [
  { label: 'Say it', cue: 'Read it, then say it back', automaticity: 0 },
  { label: 'Chorus it', cue: 'Read aloud with a steady rhythm', automaticity: 17 },
  { label: 'Faster!', cue: 'Again, faster — keep the groove', automaticity: 33 },
  { label: 'I read it aloud', cue: 'Read the full phrase aloud', automaticity: 50 },
  { label: 'Respond', cue: 'Say the Spanish for the cue', automaticity: 67 },
  { label: 'Say it cold', cue: 'From memory — no model', automaticity: 83 },
] as const

test(
  'LB-20..LB-32: completes all 30 reps and propagates real results across screens',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await onboard(page)
    await startWave(page)

    for (let phrase = 1; phrase <= 5; phrase += 1) {
      await expect(page.getByText(`Phrase ${phrase} / 5`)).toBeVisible()

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
        if (rep.automaticity === 50) {
          await expect(
            page.getByText('Gap practice is not available for this phrase yet.'),
          ).toBeVisible()
          await expect(page.getByText('Fill the gap out loud', { exact: true })).toHaveCount(0)
        }
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

test('LB-27: manual confirmation never reports speech latency', async ({ page }) => {
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  await startWave(page)
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

test('F-04: repeated confirmation commits one rep and resumes at the committed cursor', async ({
  page,
}) => {
  await onboard(page)
  await startWave(page)
  const confirm = page.getByRole('button', { name: 'Say it', exact: true })
  await confirm.evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()
  await expect(page.locator('div[aria-label$="17 percent automatic."]')).toBeVisible()
  await page.getByRole('button', { name: 'The Refrain, open the menu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(repsTodayRow(page, 1)).toBeVisible()
  await startWave(page)
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()
  await expect(page.locator('div[aria-label$="17 percent automatic."]')).toBeVisible()
})
