import { expect, type Page } from '@playwright/test'

export async function reachBootstrap(page: Page, scenario: 'loading' | 'error'): Promise<void> {
  await page.goto('/')
  // Navigation completion precedes async initialization. Wait until the current boot
  // has consumed its one-shot seam before arming the NEXT document's boot.
  await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
  await page.evaluate((value) => {
    sessionStorage.setItem('loro:bootstrap-test', value)
  }, scenario)
  await page.reload()
  await expect(
    page.getByText(
      scenario === 'loading'
        ? 'Opening your learning space…'
        : 'We couldn’t open your learning space. Please try again.',
    ),
  ).toBeVisible()
}

export async function reachWriteFailure(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Today, open the menu/ }).click()
  await page.getByRole('button', { name: 'Languages', exact: true }).click()
  await page
    .getByRole('radiogroup', { name: 'I want to learn' })
    .getByRole('radio', { name: 'Български' })
    .click()
  await page.evaluate(() => {
    const fail = (globalThis as typeof globalThis & { __loroFailNextWrite?: () => void })
      .__loroFailNextWrite
    if (!fail) throw new Error('Development write seam unavailable')
    fail()
  })
  await page.getByRole('button', { name: 'Save languages' }).click()
  await expect(page.getByRole('alert')).toContainText('Your progress couldn’t be saved.')
}
