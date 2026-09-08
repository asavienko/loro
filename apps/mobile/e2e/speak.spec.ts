import { expect, onboard, test } from './fixtures'

test('Speak reveals offline without claiming a spoken completion', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()
  await page.getByRole('button', { name: 'Speak', exact: true }).click()
  await expect(page.getByText('No on-device speech here — tap to reveal a word.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hear answer', exact: true })).toBeDisabled()
  const reveal = page.getByRole('button', { name: 'Reveal a word', exact: true })
  await reveal.click()
  await expect(page.getByText(/^1 of \d+ words revealed$/)).toBeVisible()
  while (await reveal.isEnabled()) await reveal.click()
  await expect(page.getByText('Phrase revealed. Try saying it aloud.')).toBeVisible()
  await expect(page.getByText('You said the whole phrase.')).toBeHidden()
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click()
  await expect(page.getByText(/^0 of \d+ words revealed$/)).toBeVisible()
})

test('Speak skip advances without unlocking or claiming progress', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()
  await page.getByRole('button', { name: 'Speak', exact: true }).click()
  await page.getByRole('button', { name: 'Skip phrase', exact: true }).click()
  await expect(page.getByText(/^0 of \d+ words revealed$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase', exact: true })).toBeDisabled()
})
