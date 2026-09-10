import { expect, onboard, test } from './fixtures'
import { openMusic, selectThreePhrases } from './musicFlow'

test('phrase songs: pick lyrics, review, confirm styles, and play a fixture', async ({ page }) => {
  await onboard(page)
  await openMusic(page)
  await expect(page.getByRole('button', { name: 'Write lyrics', exact: true })).toBeDisabled()
  await selectThreePhrases(page)
  await page.getByRole('button', { name: 'Write lyrics', exact: true }).click()
  await expect(page.getByText('Review the lyrics')).toBeVisible()
  await expect(
    page.getByText('Sing-along card — a bundled lyric floor, not a generated AI song.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Continue to styles', exact: true }).click()
  await expect(page.getByText('Choose 2 to 4 styles')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Acoustic folk', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Make the songs', exact: true }).click()
  await expect(page.getByText('Generated song — not a pronunciation model')).toBeVisible()
  await page.getByRole('button', { name: 'Play generated song', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pause generated song', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('400 ms')).toBeVisible()
})

test('phrase songs: generation unavailable stays honest and keeps the picker', async ({ page }) => {
  await onboard(page)
  await page.goto('/music?musicState=unavailable')
  await expect(
    page.getByText(
      'Song generation needs a connection. You can still pick phrases and keep these lyrics.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make the songs', exact: true })).toBeDisabled()
})
