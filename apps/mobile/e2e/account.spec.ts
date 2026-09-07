import { expect, onboard, test } from './fixtures'
import { reachAccount } from './accountFlow'
import { todayMarker } from './states'
test('account sign-in and sign-out retain the active learning session', async ({ page }) => {
  await onboard(page)
  await reachAccount(page, 'signedIn')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  await page.getByRole('button', { name: 'Account, open the menu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
  await expect(page.getByRole('button', { name: /percent automatic/ }).first()).toBeVisible()
})
test('rejected callback state creates no app session', async ({ page }) => {
  await onboard(page)
  await reachAccount(page, 'error')
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeEnabled()
})
