import { expect, onboard, test } from './fixtures'

test(
  'LB-01..LB-08: Today exposes the finite set, waves, stats, and every route',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await onboard(page)

    await expect(page.getByRole('button', { name: /0 percent automatic/ })).toHaveCount(5)
    await expect(page.getByText("Today's three waves")).toBeVisible()
    await expect(page.getByText('Morning', { exact: true })).toBeVisible()
    await expect(page.getByText('Midday', { exact: true })).toBeVisible()
    await expect(page.getByText('Evening', { exact: true })).toBeVisible()
    await expect(page.getByText('0 of 5 locked in')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start the wave →' })).toBeEnabled()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page).toHaveURL(/\/progress$/)
    await expect(page.getByText('Phrase mastery')).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/add$/)
    await expect(page.getByRole('textbox', { name: 'Search phrases' })).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Stream' }).click()
    await expect(page).toHaveURL(/\/practice\/stream$/)
    await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Start the wave →' }).click()
    await expect(page).toHaveURL(/\/practice\/refrain$/)
    await expect(page.getByRole('button', { name: 'Say it' })).toBeVisible()
  },
)
