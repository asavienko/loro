import { expect, type Page } from '@playwright/test'

/** More → Phrase songs. The garnish is not a rail destination. */
export async function openMusic(page: Page): Promise<void> {
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Phrase songs', exact: true }).click()
  await expect(page).toHaveURL(/\/music/)
  await expect(page.getByText('Phrase songs').first()).toBeVisible()
  await expect(page.getByText('Choose 3 to 8 phrases')).toBeVisible()
}

export async function selectThreePhrases(page: Page): Promise<void> {
  const boxes = page.getByRole('checkbox')
  await expect(boxes.first()).toBeVisible()
  for (let index = 0; index < 3; index += 1) {
    await boxes.nth(index).click()
  }
  await expect(page.getByText('3 phrases selected')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Write lyrics', exact: true })).toBeEnabled()
}

/** Hydrated fixture states after onboarding. Persistence reloads catalog rows. */
export async function openMusicFixture(page: Page, state: string): Promise<void> {
  await page.goto(`/music?musicState=${state}`)
  await expect(page.getByText('Phrase songs').first()).toBeVisible()
}
