import { expect, onboard, test } from './fixtures'

test('adaptive stream rerates, reorders, transports, loves, and learns phrases', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  await expect(page.getByText("How's this one?")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()

  await page.getByRole('radio', { name: 'Difficult' }).click()
  await expect(page.getByRole('alert')).toContainText('repeats more, comes back sooner')
  await page.getByRole('button', { name: 'Love this phrase' }).click()
  await expect(page.getByRole('button', { name: 'Remove from loved' })).toBeVisible()

  await expect(page.getByText('1 / 10')).toBeVisible()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText('2 / 10')).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText('1 / 10')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText('2 / 10')).toBeVisible()

  await page.getByRole('button', { name: 'Mark learned' }).click()
  await expect(page.getByText('Learned 1')).toBeVisible()
})

test('adaptive stream reaches its all-learned empty state', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  for (let remaining = 10; remaining > 0; remaining -= 1) {
    await page.getByRole('button', { name: 'Mark learned' }).click()
  }

  await expect(page.getByText('Your stream is empty')).toBeVisible()
  await expect(page.getByText('Add phrases to start listening')).toBeVisible()
})
