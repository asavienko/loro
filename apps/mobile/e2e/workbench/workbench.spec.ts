import { expect, test } from '../fixtures'
import { fillField } from '../helpers'

const TOKEN_ROW = '[data-testid="token-row"]'

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/tokens')
  await expect(page.getByRole('heading', { name: 'Design system workbench' })).toBeVisible()
})

test('F-05: enumerates and searches generated tokens', async ({ page }) => {
  const rows = page.locator(TOKEN_ROW)
  const initialCount = await rows.count()
  expect(initialCount, 'the workbench must enumerate generated token rows').toBeGreaterThan(0)

  await expect(page.getByRole('textbox', { name: 'Search tokens' })).toBeVisible()
  await fillField(page, 'Search tokens', 'accent')

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

test('F-05: production interaction specimens expose busy and forced focus feedback', async ({
  page,
}) => {
  const loading = page.getByRole('button', { name: 'Pending production action' })
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  await expect(loading).toHaveAttribute('aria-disabled', 'true')

  const forced = page.getByRole('button', { name: 'Pressed and focused production action' })
  await expect(forced).toHaveCSS('outline-width', '2px')
  await expect(forced).toHaveCSS('outline-style', 'solid')
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

test('F-05: direct production exports support local language and navigation inspection', async ({
  page,
}) => {
  const choices = page.getByRole('radiogroup', { name: 'Workbench language choices' })
  await expect(choices.getByRole('radio', { name: 'Български' })).toBeChecked()
  const russian = choices.getByRole('radio', { name: 'Русский' })
  await russian.focus()
  await russian.press('Enter')
  await expect(russian).toBeChecked()
  await expect(choices.getByRole('radio', { name: 'Български' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Open specimen navigation' }).click()
  await expect(page.getByLabel('Workbench, current destination', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Example destination', exact: true }).click()
  await expect(page.getByText('Specimen navigation', { exact: true })).not.toBeVisible()
  await expect(page).toHaveURL(/\/dev\/tokens/)
  await expect(page.getByRole('button', { name: 'Unavailable specimen audio' })).toBeDisabled()
})

test('F-05: registers plan-100 motion primitives as production specimens', async ({ page }) => {
  for (const name of [
    'Arrival',
    'WarmingSurface',
    'BeatBars',
    'Equalizer',
    'PulseRing',
    'UnblurText',
  ]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByTestId('arrival')).toBeVisible()
  await expect(page.getByTestId('warming-surface')).toBeVisible()
  await expect(page.getByTestId('beat-bars')).toBeVisible()
  await expect(page.getByTestId('equalizer')).toBeVisible()
  await expect(page.getByTestId('pulse-ring')).toBeVisible()
  await expect(page.getByTestId('unblur-word')).toBeVisible()

  // Reduce Motion keeps the indicators; only the loop/glow goes. Browser E2E cannot
  // prove 60 fps, but it can prove the specimens do not disappear behind the switch.
  const reducedMotion = page.getByRole('switch', { name: 'Reduced motion' })
  await reducedMotion.click()
  await expect(reducedMotion).toBeChecked()
  await expect(page.getByTestId('arrival')).toBeVisible()
  await expect(page.getByTestId('warming-surface')).toBeVisible()
  await expect(page.getByTestId('beat-bars')).toBeVisible()
  await expect(page.getByTestId('equalizer')).toBeVisible()
  await expect(page.getByTestId('pulse-ring')).toBeVisible()
  await expect(page.getByTestId('unblur-word')).toBeVisible()
})
