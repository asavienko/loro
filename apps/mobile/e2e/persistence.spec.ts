import { expect, onboard, openFirstPhrase, test } from './fixtures'
import { startRefrain } from './helpers'
import { openStorageFailure } from './persistenceFlow'

test('F-02/LB-01: duplicate completion and reload preserve one rep and its next checkpoint', async ({
  page,
}) => {
  await onboard(page)
  await openFirstPhrase(page)
  const phraseUrl = page.url()
  await page.reload()
  await expect(page).toHaveURL(phraseUrl)
  await expect(page.getByRole('button', { name: 'Practice now →' })).toBeVisible()
  await page.goto('/')
  await startRefrain(page)
  // Two handlers enter before the asynchronous engine result returns. Only this
  // displayed attempt may commit, including after its database is reopened.
  await page.getByRole('button', { name: 'Say it', exact: true }).evaluate((button) => {
    ;(button as HTMLElement).click()
    ;(button as HTMLElement).click()
  })
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()
  await expect(page.locator('div[aria-label$="17 percent automatic."]')).toBeVisible()
})

test('F-02/F-08: reload preserves each course and the active language selection', async ({
  page,
}) => {
  await onboard(page)
  const chooseTarget = async (language: string): Promise<void> => {
    await page.getByRole('button', { name: /Today, open the menu/ }).click()
    await page.getByRole('button', { name: 'Languages', exact: true }).click()
    await page
      .getByRole('radiogroup', { name: 'I want to learn' })
      .getByRole('radio', { name: language })
      .click()
    await page.getByRole('button', { name: 'Save languages' }).click()
  }
  await chooseTarget('Български')
  await page.getByRole('checkbox').first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start learning 🎧' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Stream, 4 phrases' })).toBeVisible()
  await chooseTarget('Español')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Stream, 10 phrases' })).toBeVisible()
})

test('F-02: damaged browser storage shows recovery without deleting the original data', async ({
  page,
}) => {
  await openStorageFailure(page)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByTestId('storage-error')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('loro.sqlite.v1'))).toBe(
    'damaged database retained for recovery',
  )
})
