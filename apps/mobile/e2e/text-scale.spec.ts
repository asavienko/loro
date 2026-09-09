/**
 * Every state at raised text size.
 *
 * ── What this is checking ──
 * `accessibility.md#text-and-layout` promises three things about large text: Dynamic Type up
 * to 200%, no truncation because "rows grow vertically", and chip rows that "wrap or scroll".
 * `testing-strategy.md:165` lists Dynamic Type at five scale steps as a priority. Nothing
 * measured any of it, and the failure mode is invisible in code review — a `height` where a
 * `minHeight` belonged looks identical until the text is bigger than the box.
 *
 * ── How the scale is applied ──
 * react-native-web writes each text style as an inline `font-size` in px, and the OS font
 * scale that drives Dynamic Type does not exist in a browser. Browser zoom is not a
 * substitute: it scales layout too, so everything grows together and nothing ever overflows,
 * which is the one outcome that would make this suite useless. So the scale is applied the
 * way the runtime typography provider applies it — TEXT ONLY — by multiplying font size,
 * line height and letter spacing and
 * leaving every box, gap and padding alone, then letting flexbox reflow.
 *
 * Two steps rather than five: 200% is the promise in the spec, and 310% is iOS's largest
 * accessibility size. The sizes in between fail wherever those two do.
 *
 * ── What it does NOT prove ──
 * Nothing here says whether the result looks good, and it cannot: the device matrix and a
 * human eye own that (docs/process/qa-device-matrix.md). This asserts only the mechanical
 * failures — text clipped by a fixed box, a row pushed off-screen, a control that stops
 * being reachable — which are the ones worth a machine's time.
 *
 * See plans/51-extended-e2e-strategy.md §5.
 */

import type { Page } from '@playwright/test'
import { expect, onboard, test } from './fixtures'
import { enter, START_WAVE, STATES, todayMarker } from './states'

/** 200% is the documented promise; 310% is iOS's largest accessibility size. */
const SCALES = [2, 3.1] as const

for (const scale of SCALES) {
  test(`wave times remain complete at ${scale * 100}% text`, async ({ page }) => {
    await onboard(page)
    await scaleText(page, scale)
    for (const time of ['08:00', '13:00', '19:00']) {
      const label = page.getByText(time, { exact: true })
      await expect(label).toBeVisible()
      expect(
        await label.evaluate((node) => {
          const range = document.createRange()
          range.selectNodeContents(node)
          const text = range.getBoundingClientRect()
          const box = node.getBoundingClientRect()
          return text.width <= box.width + 1 && text.height <= box.height + 1
        }),
        `${time} must fit without ellipsis`,
      ).toBe(true)
    }
  })
  test(`text at ${scale * 100}% never clips or overflows`, async ({ page }) => {
    // This one test visits all 71 states. The 200% sweep measured nearly 90 seconds
    // after adding durable storage and the complete provider/email account states.
    test.setTimeout(120_000)
    const problems: string[] = []

    for (const state of STATES) {
      await enter(page, state, onboard)
      await scaleText(page, scale)
      problems.push(...(await layoutProblems(page, state.name)))
    }

    expect(problems, `layout failures at ${scale * 100}% text`).toEqual([])
  })
}

test('the primary action stays reachable at 310% text', async ({ page }) => {
  await onboard(page)
  await scaleText(page, 3.1)

  // Today's bottom bar is absolutely positioned, so it is the one most likely to be pushed
  // out of the viewport or covered when everything above it grows.
  const start = page.getByRole('button', { name: START_WAVE })
  await expect(start).toBeVisible()
  await expect(start).toBeInViewport()

  // And it still works, which `toBeVisible` alone does not establish — a covered element is
  // visible and unclickable.
  await start.click()
  await expect(page).toHaveURL((url) => url.pathname === '/practice/refrain')
})

test('onboarding can still be completed at 310% text', async ({ page }) => {
  await page.goto('/onboarding')
  await scaleText(page, 3.1)
  await page.getByRole('button', { name: "Let's go →" }).click()

  // Each step re-scales: the new step's text is rendered after the previous scale pass.
  for (const answer of [/Just curious/, /Starting out/, /10 minutes/]) {
    await scaleText(page, 3.1)
    await page.getByRole('radio', { name: answer }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  await scaleText(page, 3.1)
  await page.getByRole('checkbox', { name: /Café & ordering/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText("You're all set")).toBeVisible()
  await page.getByRole('button', { name: 'Start learning 🎧' }).click()
  await expect(todayMarker(page)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multiply inline typography metrics by `factor`, leaving boxes untouched.
 *
 * Idempotent per element: the original size is stashed in a data attribute, so calling this
 * twice on the same page does not compound.
 */
async function scaleText(page: Page, factor: number): Promise<void> {
  await page.evaluate((f) => {
    for (const node of Array.from(document.querySelectorAll<HTMLElement>('[style*="font-size"]'))) {
      for (const property of ['fontSize', 'lineHeight', 'letterSpacing'] as const) {
        const key = `base${property}`
        const original = node.dataset[key] ?? node.style[property]
        node.dataset[key] = original
        if (original.endsWith('px')) node.style[property] = `${Number.parseFloat(original) * f}px`
      }
    }
  }, factor)
}

/**
 * Mechanical layout failures on the current page.
 *
 * Three kinds, and the exclusions matter as much as the checks:
 *
 *   • The page must not scroll HORIZONTALLY. A phone layout that does has lost content
 *     off the right edge, and `accessibility.md` requires chip rows to wrap or scroll
 *     inside themselves rather than widen the screen.
 *   • Text must not be clipped by a box that cannot grow — `overflow: hidden` with content
 *     taller than the box. Deliberate single-line clamps are excluded: a `numberOfLines`
 *     row renders `text-overflow: ellipsis` or `-webkit-line-clamp`, which is a designed
 *     truncation with a visible affordance, not a layout failure.
 *   • No interactive element may be pushed outside the viewport's width.
 */
async function layoutProblems(page: Page, state: string): Promise<string[]> {
  const found = await page.evaluate(() => {
    const problems: string[] = []
    const root = document.scrollingElement ?? document.documentElement
    if (root.scrollWidth > root.clientWidth + 1) {
      problems.push(`the page scrolls horizontally (${root.scrollWidth} > ${root.clientWidth})`)
    }

    const label = (node: Element): string => {
      const name = node.getAttribute('aria-label') ?? node.textContent.trim()
      return name.length === 0 ? '<no text>' : name.slice(0, 48)
    }

    for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input'))) {
      const style = window.getComputedStyle(input)
      const textHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize)
      const needed =
        textHeight + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
      if (input.clientHeight + 1 < needed) problems.push(`input clips text: "${label(input)}"`)
    }

    for (const node of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const style = window.getComputedStyle(node)
      if (style.overflow !== 'hidden') continue
      // A `numberOfLines` row renders an ellipsis or a line clamp: designed truncation with
      // a visible affordance, not a box that cannot grow.
      const clamped =
        style.textOverflow === 'ellipsis' || style.getPropertyValue('-webkit-line-clamp') !== 'none'
      if (!clamped && node.scrollHeight > node.clientHeight + 1) {
        problems.push(`clipped: "${label(node)}" (${node.scrollHeight} > ${node.clientHeight})`)
      }
    }

    /**
     * A control past the right edge is only a problem if nothing can scroll it back.
     * `accessibility.md` explicitly permits chip rows to "wrap or scroll", and Add's
     * scenario row is a horizontal `ScrollView` (`app/add.tsx:190`) — everything in it
     * starts off-screen by design.
     */
    const inHorizontalScroller = (node: Element): boolean => {
      for (let at = node.parentElement; at !== null; at = at.parentElement) {
        const overflowX = window.getComputedStyle(at).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') return true
      }
      return false
    }

    const interactive = '[role="button"],[role="radio"],[role="checkbox"],[role="link"],input'
    for (const node of Array.from(document.querySelectorAll(interactive))) {
      const box = node.getBoundingClientRect()
      if (box.width === 0 || inHorizontalScroller(node)) continue
      if (box.right > root.clientWidth + 1 || box.left < -1) {
        const span = `${Math.round(box.left)}…${Math.round(box.right)}`
        problems.push(`unreachable: "${label(node)}" (${span} in ${root.clientWidth}px)`)
      }
    }
    return problems
  })
  return found.map((p) => `${state}: ${p}`)
}
