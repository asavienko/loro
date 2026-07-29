import { expect, onboard, openFirstPhrase, test } from './fixtures'

test('P4-02..P4-08: reports real zero-state data and drills a learner tag', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Hard to remember, 1 phrases' }).click()
  await expect(page).toHaveURL(/\/practice\/refrain$/)
  await expect(page.getByRole('alert')).toContainText('Drilling 1 “hard to remember” phrases')
})
