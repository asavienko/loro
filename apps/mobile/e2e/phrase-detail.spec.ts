import { expect, onboard, openFirstPhrase, test } from './fixtures'
import { railCount, trickyRow } from './helpers'

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
  await expect(trickyRow(page, 'Pronunciation', 1)).toBeVisible()
})

test('P2-26: removes a phrase and updates the Today stream count', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('button', { name: 'Remove' }).click()

  await expect(page).toHaveURL(/\/$/)
  // The count moved from a stat tile to the rail, where the v1.1 shell carries counts.
  await expect(railCount(page, 'Stream', 9)).toBeVisible()
})

test('P2-13: removing is acknowledged, and undoable across the navigation', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  const spanish = await page.getByRole('button', { name: /^Memory hook:|^Use hook:/ }).count()
  expect(spanish).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Remove' }).click()

  // `router.back()` fires immediately, so the toast has to survive the navigation — `ToastHost`
  // is above the stack in `_layout.tsx`. Removing used to be silent on both counts: no
  // confirmation (FS §3 omits it on purpose) and no undo, which was supposed to cover it.
  await expect(page).toHaveURL(/\/$/)
  const toast = page.getByRole('alert')
  await expect(toast).toContainText('Removed — its reps and tags go with it')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(railCount(page, 'Stream', 9)).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(railCount(page, 'Stream', 10)).toBeVisible()
  // Back in today's set at its own position, not appended as a fresh row. The store test
  // asserts the field-by-field identity; this proves the set was repaired too.
  await expect(page.getByText('0 of 5 locked in').filter({ visible: true })).toBeVisible()
})

test('an unknown phrase offers a way back into the app', async ({ page }) => {
  await page.goto('/phrase/not-a-row-id')
  await expect(page.getByText('No phrase selected')).toBeVisible()
  await expect(page.getByText('Add or tap a phrase to view it')).toBeVisible()
  await page.getByRole('button', { name: 'Go to Today' }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
})
