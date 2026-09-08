import { expect, type Page } from '@playwright/test'

export async function openStorageFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (location.search === '?storage-error')
      localStorage.setItem('loro.sqlite.v1', 'damaged database retained for recovery')
  })
  await page.goto('/?storage-error')
  await expect(page.getByTestId('storage-error')).toBeVisible()
}

export async function openStorageLoading(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (location.search !== '?storage-opening') return
    Object.defineProperty(navigator, 'locks', {
      value: {
        request: () =>
          new Promise(() => {
            /* Keep hydration pending for its accessible state. */
          }),
      },
    })
  })
  await page.goto('/?storage-opening')
  await expect(page.getByTestId('storage-opening')).toBeVisible()
}
