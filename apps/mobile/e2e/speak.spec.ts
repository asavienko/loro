import { expect, onboard, openFirstPhrase, test } from './fixtures'
import { mockTtsStatus } from './learnerApiFlow'

test('Speak reveals offline without claiming a spoken completion', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()
  await page.getByRole('button', { name: 'Speak', exact: true }).click()
  await expect(page.getByText('No on-device speech here — tap to reveal a word.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hear answer', exact: true })).toBeDisabled()
  const reveal = page.getByRole('button', { name: 'Reveal a word', exact: true })
  const hidden = page.getByLabel('Hidden word')
  const hiddenCount = await hidden.count()
  expect(hiddenCount).toBeGreaterThan(0)
  await expect(page.getByTestId('unblur-word').first()).toBeVisible()
  await reveal.click()
  await expect(page.getByText(/^1 of \d+ words revealed$/)).toBeVisible()
  await expect(hidden).toHaveCount(hiddenCount - 1)
  while (await reveal.isEnabled()) await reveal.click()
  await expect(page.getByText('Phrase revealed. Try saying it aloud.')).toBeVisible()
  await expect(page.getByText('You said the whole phrase.')).toBeHidden()
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click()
  await expect(page.getByText(/^0 of \d+ words revealed$/)).toBeVisible()
})

test('phrase detail does not claim catalog audio when none is bundled', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  await expect(page.getByText('Catalog recording · pronunciation reference')).toHaveCount(0)
  await expect(page.getByText('Audio is unavailable on this device.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play phrase', exact: true })).toBeDisabled()
})

test('phrase detail enables server-voice play when TTS status is ready', async ({ page }) => {
  await onboard(page)
  mockTtsStatus(page, true)
  await openFirstPhrase(page)
  await expect(page.getByText('Server voice · generated for this phrase')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play phrase', exact: true })).toBeEnabled()
})

test('Speak skip advances without unlocking or claiming progress', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()
  await page.getByRole('button', { name: 'Speak', exact: true }).click()
  await page.getByRole('button', { name: 'Skip phrase', exact: true }).click()
  await expect(page.getByText(/^0 of \d+ words revealed$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase', exact: true })).toBeDisabled()
})
