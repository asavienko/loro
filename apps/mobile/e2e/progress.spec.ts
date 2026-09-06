import { expect, onboard, openFirstPhrase, test } from './fixtures'
import { trickyRow } from './states'

test('P4-02..P4-08: reports real zero-state data and rolls up a learner tag', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Progress' }).click()

  await expect(page.getByText('start today')).toBeVisible()
  await expect(page.getByLabel('Last seven days: practised on 0 of them.')).toBeVisible()
  await expect(page.getByText('10 total')).toBeVisible()
  await expect(page.getByText('10 new, 0 learning, 0 strong, 0 mastered.')).toBeVisible()
  await expect(page.getByText(/Nothing tagged yet/)).toBeVisible()
  await expect(page.getByText('First 10 phrases')).toBeVisible()

  await page.getByRole('link', { name: /back/i }).click()
  await openFirstPhrase(page)
  await page.getByRole('checkbox', { name: 'Hard to remember' }).click()
  await page.getByRole('link', { name: /back/i }).click()
  await page.getByRole('button', { name: 'Progress' }).click()

  // P4-05: the rollup row states the tag and its real count.
  await expect(trickyRow(page, 'Hard to remember', 1)).toBeVisible()

  // P4-06 is NOT built, and the screen must not pretend it is: no chevron, no button, no
  // "Drilling 1 “hard to remember” phrases" toast over a session that practises today's
  // unfiltered set. Plan 64 §4 lands the filtered set; this assertion flips when it does.
  await expect(page.getByRole('button', { name: 'Hard to remember, 1 phrases' })).toHaveCount(0)
  await expect(page.getByText(/Drilling/)).toHaveCount(0)
  await expect(page).toHaveURL(/\/progress$/)
})
