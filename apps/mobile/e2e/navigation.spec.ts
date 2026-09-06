import { expect, onboard, test } from './fixtures'
import { back, open, todayMarker } from './states'

test('cold learner links provide a home escape without browser history', async ({ page }) => {
  for (const route of [
    '/add',
    '/progress',
    '/practice/stream',
    '/practice/refrain',
    '/phrase/missing',
  ] as const) {
    await page.goto(route)
    const home = page.getByRole('button', { name: 'Today', exact: true })
    await expect(home).toBeVisible()
    await expect(home).toBeInViewport()
    await home.click()
    // This app is not set up yet: the resolved home starts onboarding rather than a blank Today.
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
  }
})

test('Add retains Back to Today when entered from the app', async ({ page }) => {
  await onboard(page)
  await open(page, 'Add')
  await back(page)
  await expect(todayMarker(page)).toBeVisible()
})

test('the shared menu connects every built hub and returns from phrase detail', async ({
  page,
}) => {
  await onboard(page)
  for (const [label, path] of [
    ['Add', '/add'],
    ['Progress', '/progress'],
    ['Stream', '/practice/stream'],
    ['The Refrain', '/practice/refrain'],
    ['Today', '/'],
  ] as const) {
    await page.getByRole('button', { name: /, open the menu$/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('button', { name: /Chat|Settings|Trips/ })).toHaveCount(0)
    await sheet.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(sheet).toBeHidden()
  }
  await page
    .getByRole('button', { name: /percent automatic/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Phrase, open the menu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
})

test('the menu dismisses with Escape and restores keyboard focus', async ({ page }) => {
  await onboard(page)
  await open(page, 'Add')
  const handle = page.getByRole('button', { name: 'Add, open the menu' })
  await handle.focus()
  await handle.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(handle).toBeFocused()
})
