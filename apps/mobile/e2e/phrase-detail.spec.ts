import { expect, onboard, openFirstPhrase, test } from './fixtures'

test('P2-30..P2-40: edits every phrase control and propagates tags to Progress', async ({
  page,
}) => {
  await onboard(page)
  await openFirstPhrase(page)

  await expect(page.getByText('How hard is it for you?')).toBeVisible()
  await expect(page.getByText("What's tricky", { exact: true })).toBeVisible()
  await expect(page.getByText('Memory hook', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mark as loved' }).click()
  await expect(page.getByRole('button', { name: 'Remove from loved' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Loved')

  await page.getByRole('radio', { name: 'Difficult' }).click()
  await expect(page.getByRole('alert')).toContainText('Difficult')
  await page.getByRole('checkbox', { name: 'Pronunciation' }).click()

  const hook = page.getByRole('button', { name: /^Use hook:/ }).first()
  await hook.click()
  const selectedHook = page.getByRole('button', { name: /^Memory hook:/ })
  await expect(selectedHook).toBeVisible()
  await selectedHook.click()
  await expect(page.getByRole('button', { name: /^Use hook:/ })).not.toHaveCount(0)

  await page.getByRole('button', { name: 'Mark learned' }).click()
  await expect(page.getByRole('button', { name: 'Mark as still learning' })).toBeVisible()
  await page.getByRole('button', { name: 'Mark as still learning' }).click()
  await expect(page.getByRole('button', { name: 'Mark learned' })).toBeVisible()

  await page.getByRole('link', { name: /back/i }).click()
  await page.getByRole('button', { name: 'Progress' }).click()
  await expect(page.getByRole('button', { name: 'Pronunciation, 1 phrases' })).toBeVisible()
})

test('P2-26: removes a phrase and updates the Today stream count', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('button', { name: 'Remove' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('9', { exact: true })).toBeVisible()
  await expect(page.getByText('in your stream', { exact: true })).toBeVisible()
})

test('phrase detail has an inert not-found state for an unknown id', async ({ page }) => {
  await page.goto('/phrase/not-a-row-id')
  await expect(page.getByText('No phrase selected')).toBeVisible()
  await expect(page.getByText('Add or tap a phrase to view it')).toBeVisible()
})
