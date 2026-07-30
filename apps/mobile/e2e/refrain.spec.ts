import { expect, onboard, test } from './fixtures'

const reps = [
  { label: 'Say it', cue: 'Hear it, then say it back', automaticity: 0 },
  { label: 'Chorus it', cue: 'Say it in unison — ride the beat', automaticity: 17 },
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
    await onboard(page)
    await page.getByRole('button', { name: 'Start the wave →' }).click()

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
        await page.getByRole('button', { name: rep.label }).click()
      }

      await expect(page.locator('div[aria-label$="100 percent automatic."]')).toBeVisible()
      await expect(page.getByText('Locked in for today')).toBeVisible()
      const nextLabel = phrase === 5 ? 'Finish the set →' : 'Next phrase →'
      await page.getByRole('button', { name: nextLabel }).click()
    }

    await expect(page.getByText('¡Hecho! Today is done')).toBeVisible()
    await expect(page.getByText("Today's set is warmed up")).toBeVisible()
    await expect(page.getByText('30', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.getByRole('button', { name: 'Back to today' }).click()
    await expect(page.getByText('5 of 5 locked in').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('30', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByText('30', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByText('1', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByLabel(/Last seven days: practised on 1 of them/)).toBeVisible()
  },
)
