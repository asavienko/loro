import { expect, onboard, test } from './fixtures'

test(
  'F-06: the developer workbench is unavailable in the production bundle',
  { tag: '@smoke' },
  async ({ page }) => {
    await page.goto('/dev/tokens')

    await expect(page.getByTestId('expo-router-unmatched')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Unmatched Route' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Design system workbench' })).toHaveCount(0)

    await onboard(page)
    await expect(page.locator('a[href="/dev/tokens"], a[href$="/dev/tokens"]')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /design system|tokens workbench|developer workbench/i }),
    ).toHaveCount(0)
  },
)
