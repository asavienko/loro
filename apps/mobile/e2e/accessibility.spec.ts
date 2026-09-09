/**
 * Accessibility, against the RENDERED page.
 *
 * ── What this adds ──
 * Three accessibility gates already run in CI, and all three scan `.tsx` source text
 * (`scripts/a11yChecks.ts:27`). Source is the wrong place to catch four of the five things
 * below: whether a role's required state actually reaches the tree, whether a computed box
 * is 44 px, whether a colour pairing survives the surface it is rendered on, and whether a
 * toast is a live region. Every defect this file was written against was invisible to the
 * static checks and obvious in the browser.
 *
 * ── What web CANNOT verify, and why the static gates still matter ──
 * react-native-web 0.21 forwards only the props in its allowlist
 * (`react-native-web/src/modules/forwardedProps/index.js`). Two of the app's accessibility
 * props are not in it, so they are absent from the DOM no matter how correct the source is:
 *
 *   • `accessibilityLanguage` → no `lang` attribute. Spanish text carries `lang="es-ES"` on
 *     iOS and Android, which accessibility.md calls the highest-impact detail in the app,
 *     and the browser never sees it. `pnpm --filter @loro/mobile check:lang` is what covers
 *     this, and that is why it scans source rather than a page.
 *   • `accessibilityHint` → nothing. All fourteen hints are native-only.
 *
 * So this file does not assert either, and no one should read a green run here as evidence
 * about them. The device matrix in docs/process/qa-device-matrix.md is where they land.
 *
 * See plans/51-extended-e2e-strategy.md §4.
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, onboard, test } from './fixtures'
import { enter, openFirstPhrase, startWave, todayMarker } from './helpers'
import { STATES } from './states'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * The one waived rule, narrowly.
 *
 * `scrollable-region-focusable` wants a `tabindex` on any scrollable container so a
 * keyboard can reach it. react-native-web's `ScrollView` renders an overflow div without
 * one, and on the platforms this app ships to a `ScrollView` is scrollable by touch and by
 * a screen reader's own gestures with no tabindex involved. It fires on Progress in the
 * zero state, where the screen happens to contain no focusable descendant at all.
 *
 * Waived rather than worked around: adding a web-only `tabIndex` to product code for a
 * surface the app does not ship would be a change made to satisfy a test. If Expo Web ever
 * becomes a shipping surface this has to be revisited, and plans/35-accessibility-wcag-pass.md
 * owns that call.
 */
const WAIVED = ['scrollable-region-focusable']

/**
 * `hitSlop={8}` in `src/ui/primitives.tsx` extends the touch target by 8 px on every side
 * on iOS and Android. react-native-web does not implement it for pointer events, so the
 * rendered box is smaller than the real target and this is added back before comparing.
 */
const HIT_SLOP = 8
const MIN_TAP = 44

/**
 * Violations that are OPEN DESIGN QUESTIONS, recorded rather than hidden.
 *
 * Listing the rule id per state — instead of adding it to `WAIVED` — keeps that state under
 * the gate in both directions: a *different* violation there still fails, and so does this
 * one disappearing, which is the reminder to delete the entry once the question closes.
 *
 * `refrain · locked in`: white text on the peak warming band clears 3:1 but not 4.5:1.
 * accessibility.md#contrast-audit records this deliberately — darkening the gradient far
 * enough "would turn the app's single most important reward moment into a muddy brown" — so
 * `warming.peak` carries a `textSizeFloor: "large"` and the 13 px English subtitle the
 * blueprint renders over it is **Q-14** in docs/decisions/open-questions.md.
 */
const KNOWN: Record<string, string[]> = {
  'refrain · locked in': ['color-contrast'],
}

for (const state of STATES) {
  const known = KNOWN[state.name] ?? []

  test(`axe: ${state.name}`, async ({ page }) => {
    await enter(page, state, onboard)

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG)
      .disableRules(WAIVED)
      .analyze()

    // The offending node is in the message on purpose: a rule id alone sends the next
    // reader back to the browser to find out which element it was.
    const describe = (v: (typeof violations)[number]): string =>
      `${v.id} (${String(v.impact)}, ${v.nodes.length}×): ${v.help}\n      ${v.nodes
        .map((n) => n.html.slice(0, 220))
        .join('\n      ')}`

    expect(
      violations.filter((v) => !known.includes(v.id)).map(describe),
      `axe violations in ${state.name}`,
    ).toEqual([])

    // The recorded exceptions must still be there. If one is gone the question behind it
    // was answered, and the entry in `KNOWN` is now hiding a passing state.
    expect(
      known.filter((id) => !violations.some((v) => v.id === id)),
      `${state.name} no longer violates these, so remove them from KNOWN`,
    ).toEqual([])
  })
}

test('every interactive element meets the 44 px touch target', async ({ page }) => {
  // Account method-chooser states made this whole-manifest walk outgrow the 90 s default.
  test.setTimeout(180_000)
  const offenders: string[] = []

  for (const state of STATES) {
    await enter(page, state, onboard)
    offenders.push(...(await tooSmall(page, state.name)))
  }

  expect(offenders, 'interactive elements below the 44 px floor').toEqual([])
})

test('a radio and a checkbox report which one is chosen', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)

  // The selection used to exist only as a background colour: `role="radio"` with no
  // `aria-checked`, which is a WCAG failure and the thing accessibility.md forbids as
  // "information by colour alone".
  const easy = page.getByRole('radio', { name: 'Easy' })
  const hard = page.getByRole('radio', { name: 'Difficult' })
  await expect(easy).not.toBeChecked()
  await expect(hard).not.toBeChecked()

  await hard.click()
  await expect(hard).toBeChecked()
  await expect(easy).not.toBeChecked()

  const tag = page.getByRole('checkbox', { name: 'Pronunciation' })
  await expect(tag).not.toBeChecked()
  await tag.click()
  await expect(tag).toBeChecked()
  await tag.click()
  await expect(tag).not.toBeChecked()
})

test('onboarding reports its chosen answer at every step', async ({ page }) => {
  await page.goto('/onboarding')
  await page.getByRole('button', { name: "Let's go →" }).click()

  const trip = page.getByRole('radio', { name: /A trip coming up/ })
  await expect(trip).not.toBeChecked()
  await trip.click()
  await expect(trip).toBeChecked()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Back preserves the answer, and the answer is still reported as chosen — the state the
  // learner can see must be the state assistive tech is told.
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(trip).toBeChecked()
})

test('the automaticity bar is a named progress bar with a value', async ({ page }) => {
  await onboard(page)
  await startWave(page)

  const bar = page.getByRole('progressbar', { name: 'Automaticity' })
  await expect(bar).toHaveAttribute('aria-valuenow', '0')
  await expect(bar).toHaveAttribute('aria-valuetext', '0%')

  await page.getByRole('button', { name: 'Say it' }).click()
  await expect(bar).toHaveAttribute('aria-valuenow', '17')

  // Exactly one: the bars that restate a row's own label are hidden from the tree rather
  // than left unnamed, so a learner is not told the same number twice.
  await expect(page.getByRole('progressbar')).toHaveCount(1)
})

test('a toast is announced, not just drawn', async ({ page }) => {
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('radio', { name: 'Difficult' }).click()

  const toast = page.getByRole('alert')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  await expect(toast).toContainText('repeats more, comes back sooner')
})

test('onboarding is completable with the keyboard alone', async ({ page }) => {
  await page.goto('/onboarding')
  await pressUntil(page, "Let's go →")
  await page.keyboard.press('Enter')

  for (const answer of [/A trip coming up/, /Starting out/, /10 minutes/]) {
    await pressUntil(page, answer, 'radio')
    await page.keyboard.press('Enter')
    await pressUntil(page, 'Continue')
    await page.keyboard.press('Enter')
  }

  await pressUntil(page, /Café & ordering/, 'checkbox')
  await page.keyboard.press('Enter')
  await pressUntil(page, 'Continue')
  await page.keyboard.press('Enter')

  await expect(page.getByText("You're all set")).toBeVisible()
  await pressUntil(page, 'Start learning 🎧')
  await page.keyboard.press('Enter')
  await expect(todayMarker(page)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tab until the named control has focus, then leave it focused for the caller to activate.
 *
 * Tabbing rather than clicking is the point: it proves the control is in the focus order
 * at all, and that nothing traps focus before it.
 */
async function pressUntil(
  page: Page,
  name: string | RegExp,
  role: 'button' | 'radio' | 'checkbox' = 'button',
): Promise<void> {
  const target = page.getByRole(role, { name }).first()
  await expect(target).toBeVisible()
  for (let tab = 0; tab < 60; tab += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`'${String(name)}' never took focus after 60 tabs`)
}

/** Interactive elements whose real touch target is under 44 px, with `hitSlop` counted. */
async function tooSmall(page: Page, state: string): Promise<string[]> {
  const found = await page.evaluate(
    ({ slop, min }) => {
      const selector = '[role="button"],[role="radio"],[role="checkbox"],[role="link"],input'
      return Array.from(document.querySelectorAll(selector))
        .map((node) => {
          const box = node.getBoundingClientRect()
          return {
            name: node.getAttribute('aria-label') ?? node.textContent.slice(0, 40),
            w: Math.round(box.width) + slop * 2,
            h: Math.round(box.height) + slop * 2,
            visible: box.width > 0 && box.height > 0,
          }
        })
        .filter((b) => b.visible && (b.w < min || b.h < min))
        .map((b) => `${b.name} (${b.w}×${b.h})`)
    },
    { slop: HIT_SLOP, min: MIN_TAP },
  )
  return found.map((f) => `${state}: ${f}`)
}
