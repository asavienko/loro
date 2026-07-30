import { expect, test } from '../fixtures'

const TOKEN_ROW = '[data-testid="token-row"]'

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/tokens')
  await expect(page.getByRole('heading', { name: 'Design system workbench' })).toBeVisible()
})

test('F-05: enumerates and searches generated tokens', async ({ page }) => {
  const rows = page.locator(TOKEN_ROW)
  const initialCount = await rows.count()
  expect(initialCount, 'the workbench must enumerate generated token rows').toBeGreaterThan(0)

  const search = page.getByRole('textbox', { name: 'Search tokens' })
  await search.fill('accent')

  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(initialCount)
  for (const row of await rows.allTextContents()) expect(row.toLowerCase()).toContain('accent')
})

test('F-05: inspection controls are named, stateful, and keyboard operable', async ({ page }) => {
  const accent = page.getByRole('group', { name: 'Accent theme' })
  const reducedMotion = page.getByRole('switch', { name: 'Reduced motion' })
  const textScale = page.getByRole('group', { name: 'Text scale' })
  const deviceSize = page.getByRole('group', { name: 'Device size' })
  const safeArea = page.getByRole('switch', { name: 'Safe area' })

  await expect(accent).toBeVisible()
  await expect(reducedMotion).toBeVisible()
  await expect(textScale).toBeVisible()
  await expect(deviceSize).toBeVisible()
  await expect(safeArea).toBeVisible()

  await reducedMotion.focus()
  await reducedMotion.press('Enter')
  await expect(reducedMotion).toBeChecked()

  const accentChoices = accent.getByRole('button')
  expect(
    await accentChoices.count(),
    'accent control must expose at least two themes',
  ).toBeGreaterThan(1)
  const nextAccent = accentChoices.nth(1)
  await nextAccent.focus()
  await nextAccent.press('Enter')
  await expect(nextAccent).toHaveAttribute('aria-pressed', 'true')
})

test('F-05: remains usable at the authored phone size and 310% text', async ({ page }) => {
  const textScale = page.getByRole('group', { name: 'Text scale' })
  const deviceSize = page.getByRole('group', { name: 'Device size' })
  const specimenLabel = page
    .getByTestId('workbench-screenshot-specimen')
    .getByText('Production button')
  const defaultFontSize = Number.parseFloat(
    await specimenLabel.evaluate((node) => getComputedStyle(node).fontSize),
  )

  await textScale.getByRole('button', { name: '310%' }).click()
  await deviceSize.getByRole('button', { name: /344.*732/ }).click()
  await expect
    .poll(async () =>
      Number.parseFloat(await specimenLabel.evaluate((node) => getComputedStyle(node).fontSize)),
    )
    .toBeGreaterThan(defaultFontSize * 3)

  const viewport = page.getByTestId('workbench-viewport')
  await expect(viewport).toBeVisible()
  await expect(page.getByTestId('workbench-screenshot-specimen')).toHaveScreenshot(
    'production-components-at-310-percent.png',
    {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  )

  const metrics = await viewport.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))
  expect(metrics.scrollWidth, '310% text must not cause horizontal overflow').toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  )
})
