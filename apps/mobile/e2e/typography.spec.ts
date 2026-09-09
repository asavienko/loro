import type { Page } from '@playwright/test'
import { expect, onboard, test } from './fixtures'
import { open, startWave } from './states'

/** Measure glyphs using the rendered production text styles, not the width of a flex box. */
async function expectStableNumerals(page: Page) {
  const samples = await page.evaluate(async () => {
    await document.fonts.ready
    return Array.from(document.querySelectorAll<HTMLElement>('[lang]'))
      .filter(
        (node) =>
          node.children.length === 0 &&
          /\d/.test(node.textContent) &&
          node.getBoundingClientRect().height > 0,
      )
      .map((node) => {
        const variant = getComputedStyle(node).fontVariantNumeric
        const probe = node.cloneNode(false) as HTMLElement
        probe.setAttribute('aria-hidden', 'true')
        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        node.parentElement?.append(probe)
        try {
          const widths = Array.from('0123456789', (digit) => {
            probe.textContent = digit.repeat(4)
            const range = document.createRange()
            range.selectNodeContents(probe)
            return range.getBoundingClientRect().width
          })
          return { text: node.textContent, variant, widths }
        } finally {
          probe.remove()
        }
      })
  })

  expect(samples.length, 'the route must exercise visible learner numbers').toBeGreaterThan(0)
  for (const sample of samples) {
    expect(sample.variant, sample.text).toContain('tabular-nums')
    expect(Math.min(...sample.widths), sample.text).toBeGreaterThan(0)
    expect(Math.max(...sample.widths) - Math.min(...sample.widths), sample.text).toBeLessThan(0.05)
  }
}

test('F-05: Today, progress and practice digits keep equal advances', async ({ page }) => {
  await onboard(page)
  await expectStableNumerals(page)
  await open(page, 'Progress')
  await expect(page.getByText('10 total')).toBeVisible()
  await expectStableNumerals(page)
  await page.getByRole('link', { name: /back/i }).click()
  await startWave(page)
  await expectStableNumerals(page)
})
