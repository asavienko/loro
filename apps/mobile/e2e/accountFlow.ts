/** F-01. Simulated provider transport only; production has no test identity or bypass. */
import { expect, type Page } from '@playwright/test'
export type AccountScenario =
  | 'discoveryError'
  | 'unavailable'
  | 'ready'
  | 'busy'
  | 'error'
  | 'cancelled'
  | 'signedIn'
  | 'localSignOut'
export async function reachAccount(page: Page, scenario: AccountScenario): Promise<void> {
  // Whole-manifest sweeps reuse the page. Close the previous pending-provider popup.
  for (const popup of page.context().pages()) {
    if (popup !== page) await popup.close()
  }
  const state = 's'.repeat(43)
  await page.context().route('https://auth.loro.test/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/providers') && scenario === 'discoveryError')
      return route.fulfill({ json: {} })
    if (path.endsWith('/providers'))
      return route.fulfill({
        json: { providers: scenario === 'unavailable' ? [] : ['google', 'apple'] },
      })
    if (path.endsWith('/start'))
      return route.fulfill({
        json: { authorization_url: `https://provider.loro.test/authorize?state=${state}`, state },
      })
    if (path.endsWith('/logout') && scenario === 'localSignOut')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'unreadable-response',
      })
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 })
    return route.fulfill({
      json: {
        access_token: 'test-access-token',
        refresh_token: 'r'.repeat(43),
        expires_in: 900,
        user: { id: 'e72087c7-5015-492b-8c23-ad8b54aff305', provider: 'google' },
      },
    })
  })
  await page.context().route('https://provider.loro.test/**', async (route) => {
    const callback = new URL('/account', page.url())
    callback.searchParams.set('state', scenario === 'error' ? 'wrong' : state)
    callback.searchParams.set('ticket', 't'.repeat(43))
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><a href="${callback.toString()}">Finish provider sign-in</a></body></html>`,
    })
  })
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Account', exact: true }).click()
  const google = page.getByRole('button', { name: 'Continue with Google' })
  if (scenario === 'discoveryError') {
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    return
  }
  if (scenario === 'unavailable') {
    await expect(google).toBeDisabled()
    await expect(page.getByText(/Sign-in is not available/)).toBeVisible()
    return
  }
  await expect(google).toBeEnabled()
  if (scenario === 'ready') return
  const popupPromise = page.waitForEvent('popup')
  await google.click()
  const popup = await popupPromise
  await expect(popup.getByRole('link')).toBeVisible()
  if (scenario === 'busy') {
    await expect(page.getByText('Connecting…')).toBeVisible()
    return
  }
  if (scenario === 'cancelled') await popup.close()
  else await popup.getByRole('link').click()
  if (scenario === 'error') await expect(page.getByText(/We could not complete/)).toBeVisible()
  else if (scenario === 'cancelled') await expect(page.getByText(/Sign-in cancelled/)).toBeVisible()
  else {
    await expect(page.getByText('You are signed in.')).toBeVisible()
    if (scenario === 'localSignOut') {
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await expect(page.getByText(/You are signed out on this device/)).toBeVisible()
    }
  }
}
