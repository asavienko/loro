/**
 * The rendered geometry a semantic locator cannot see.
 *
 * ── Why this file exists ──
 * Every other suite here asks the accessibility tree what the screen says. That is the right
 * default, and it is blind to a whole class of defect: a chart whose segments are 0 px tall still
 * has its legend, its counts and its summary, so `progress · with a tagged phrase` passed axe,
 * passed text scale, and passed `progress.spec.ts` while the mastery bar drew an empty groove
 * (`app/progress.tsx`, `alignItems: 'center'` over segments that declare no height). A bar at a
 * FABRICATED value is caught by reading its label; a bar at no height at all is caught only by
 * measuring it.
 *
 * ── What this is not ──
 * Not a screenshot suite. Nothing here compares pixels, and nothing here asserts a value a
 * designer may legitimately change: each test measures a RELATIONSHIP the screen claims — "these
 * segments are the shares of that total", "this fill is that percentage", "there is no bar over
 * silence" — against numbers the same page states in words. A restyle passes. A chart that stops
 * charting fails.
 *
 * ── How a bar is found ──
 * react-native-web compiles `StyleSheet` entries to class names, so there is no inline style to
 * match and no `testID` in learner code to lean on. `bars()` instead finds every element whose
 * children are all EMPTY — no text, no children of their own — which is exactly the shape of a
 * track and its fills, and of nothing else on these screens. A legend row holds text, so it is
 * excluded by construction rather than by a selector that a restyle would break.
 *
 * See plans/55-current-surface-truth-and-fidelity.md §5.
 */

import type { Page } from '@playwright/test'
import { expect, onboard, test } from './fixtures'
import { open, startWave } from './states'

interface Box {
  readonly width: number
  readonly height: number
}

interface Bar {
  readonly track: Box
  readonly fills: readonly Box[]
}

/**
 * Every track-and-fill bar inside the nearest ancestor of `heading` that also matches `within`.
 *
 * `heading` names the block (a card's title); `within` is a pattern the same block states in
 * words, which is what bounds the search to that block rather than to a class name. Pass `null`
 * for `heading` to scan the whole page — which is how "this screen draws no bar at all" is
 * asserted, since the bar that has to be absent is `aria-hidden` and invisible to a role locator.
 */
async function bars(page: Page, heading: string | null, within: RegExp): Promise<Bar[]> {
  return page.evaluate(
    ({ heading: title, within: pattern }) => {
      const box = (node: Element): Box => {
        const rect = node.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }
      const empty = (node: Element): boolean =>
        node.children.length === 0 && node.textContent === ''

      let block: HTMLElement | null = document.body
      if (title !== null) {
        const matches = new RegExp(pattern)
        const titleNode = Array.from(document.querySelectorAll('div')).find(
          (node) => node.children.length === 0 && node.textContent === title,
        )
        block = titleNode?.parentElement ?? null
        while (block !== null && !matches.test(block.textContent)) block = block.parentElement
      }
      if (block === null) return []

      /**
       * Bar-SHAPED: drawn, and at least ten times wider than it is tall.
       *
       * Without a shape rule a whole-page scan returns every zero-size layout wrapper
       * react-native-web emits and every full-width band that happens to hold one empty child.
       * Ten is not a design value, it is the gap: the app's bars are 4–12 px tall across a
       * 390 px phone (ratios 25–55), a legend `Dot` is 9×9 (1), a streak cell ~48×30 (1.6), and
       * the widest band that fooled an earlier draft was 390×64 (6). Nothing sits near 10.
       */
      const barShaped = (b: Box): boolean => b.width > 0 && b.height > 0 && b.width >= b.height * 10

      return Array.from(block.querySelectorAll('div'))
        .filter((node) => node.children.length > 0 && Array.from(node.children).every(empty))
        .map((node) => ({ track: box(node), fills: Array.from(node.children).map(box) }))
        .filter((bar) => barShaped(bar.track))
    },
    { heading, within: within.source },
  )
}

test('P4-04: the mastery bar draws its buckets at their real share of the total', async ({
  page,
}) => {
  await onboard(page)

  // One rep moves one phrase out of `new` and into `learning`, so the bar has two segments with
  // a share each — a single full-width segment cannot tell a working chart from a broken one.
  await startWave(page)
  await page.getByRole('button', { name: 'Say it' }).click()
  await page.goBack()
  await open(page, 'Progress')

  // What the screen states in words. The chart has to agree with it.
  await expect(page.getByText('9 new, 1 learning, 0 strong, 0 mastered.')).toBeVisible()

  const [bar] = await bars(page, 'Phrase mastery', /\d+ new, \d+ learning/)
  expect(bar, 'the mastery bar was not found').toBeDefined()
  const { track, fills } = bar ?? { track: { width: 0, height: 0 }, fills: [] }

  expect(fills, 'a bucket with a count draws a segment; an empty one draws nothing').toHaveLength(2)

  // THE REGRESSION. Every segment fills the track's height, or none of them does — and zero is
  // what made this chart invisible while every semantic assertion still passed.
  for (const fill of fills) {
    expect(fill.height, `a mastery segment is ${String(fill.height)}px tall`).toBeGreaterThan(0)
    expect(fill.height).toBeCloseTo(track.height, 0)
  }

  // And the widths are the shares, not an even split: 9 new to 1 learning.
  const filled = fills.reduce((sum, fill) => sum + fill.width, 0)
  expect(filled).toBeCloseTo(track.width, 0)
  expect((fills[0]?.width ?? 0) / filled).toBeCloseTo(0.9, 1)
  expect((fills[1]?.width ?? 0) / filled).toBeCloseTo(0.1, 1)
})

test('P3-03: nothing bar-shaped is drawn over silence on the stream', async ({ page }) => {
  await onboard(page)
  await open(page, 'Stream')
  await expect(page.getByText(/Audio is not available yet/)).toBeVisible()

  // `stream.spec.ts` proves there is no `role="progressbar"`, which is the NAMED form. The
  // fabricated 35% bar was the unnamed one — `aria-hidden`, so no role locator could see it, and
  // that is exactly why it survived two rounds of E2E. This looks for the shape instead.
  expect(
    await bars(page, null, /./),
    'the stream drew a bar; nothing plays, so nothing can have a position',
  ).toEqual([])
})

test("LB-04: a Today set row's bar is the automaticity its own label states", async ({ page }) => {
  await onboard(page)
  await startWave(page)
  await page.getByRole('button', { name: 'Say it' }).click()
  await page.goBack()

  // One rep of six. The row says so in words; the bar has to say the same thing in pixels, and it
  // cannot be READ for it — the bar is deliberately unnamed so the row announces its number once.
  await expect(page.getByRole('button', { name: /17 percent automatic/ })).toBeVisible()

  // Page-wide: Today's only bars are its five set rows. Returning from the Refrain leaves the
  // popped screen's copy in the DOM at zero size, which the "drawn" half of `barShaped` drops.
  const rows = await bars(page, null, /./)
  expect(rows, 'one bar per phrase in today’s set').toHaveLength(5)

  const worked = rows[0]
  expect(worked).toBeDefined()
  expect((worked?.fills[0]?.width ?? 0) / (worked?.track.width ?? 1)).toBeCloseTo(0.17, 2)

  // The four untouched phrases are at zero, and zero is drawn as nothing rather than as a
  // minimum sliver that would read as progress.
  for (const row of rows.slice(1)) expect(row.fills[0]?.width).toBe(0)
})
