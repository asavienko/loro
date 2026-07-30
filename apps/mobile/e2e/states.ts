/**
 * Every learner-visible STATE the app can be in, and how to reach it by clicking.
 *
 * ── Why states and not routes ──
 * `route-coverage.spec.ts` guards that no route lands without an E2E owner, and that guard
 * is worth keeping — but a route is not a unit of behaviour. `add` scanned clean for
 * accessibility while its difficulty sheet, which holds three radios, had never been
 * rendered; the route was "covered" and three controls in it had never been looked at. A
 * screen can gain four states and stay green.
 *
 * So this is the manifest: one entry per state, reached the way a learner reaches it. Three
 * suites consume it — accessibility, text scale, and the manifest guard in
 * `state-coverage.spec.ts` — so a new state is described once and inherits all three.
 *
 * ── The contract when a screen changes ──
 * A new state on an existing screen gets a row here in the same change. `spec` names the
 * `docs/product/functional-spec.md` section it comes from, so a state with no home in the
 * spec is visible as exactly that rather than as an untested one.
 *
 * See plans/51-extended-e2e-strategy.md §2, §4, §6.
 */

import { expect, type Page } from '@playwright/test'

const REFRAIN_REPS = [
  'Say it',
  'Chorus it',
  'Faster!',
  'Fill & say',
  'Respond',
  'Say it cold',
] as const

export interface AppState {
  /** Stable name — it becomes the test title, so it appears in CI output verbatim. */
  name: string
  /** The route the learner ends up on, as `route-coverage.spec.ts` names them. */
  route: string
  /** The `functional-spec.md` section this state is described in. */
  spec: string
  /**
   * Set when the state belongs to the FIRST-RUN flow, so the runner must not onboard first.
   * Without it a spec would complete onboarding and then navigate back into it, relying on
   * a reload resetting the in-memory store — true today, and not something to depend on.
   */
  firstRun?: true
  /** Reached from Today, immediately after `onboard()` — unless `firstRun` is set. */
  reach: (page: Page) => Promise<void>
}

export const STATES: AppState[] = [
  {
    name: 'today · seeded',
    route: '/',
    spec: '§11 Today',
    reach: (page) => expect(page.getByText('Today', { exact: true })).toBeVisible(),
  },
  {
    name: 'today · nothing in rotation',
    route: '/',
    spec: '§11 Today, empty',
    reach: async (page) => {
      // Removing every phrase, not learning them: today's set is frozen once per day, so
      // marking all ten learned leaves it exactly as it was until the next roll. `remove`
      // is the one action that empties the set the same day, because it re-runs the
      // selection with nothing left to select (`store/index.ts:258-268`).
      for (let phrase = 10; phrase > 0; phrase -= 1) {
        await openFirstPhrase(page)
        await click(page, 'Remove')
        await expect(page).toHaveURL(/\/$/)
      }
      await expect(page.getByText(/Nothing in rotation yet/)).toBeVisible()
    },
  },
  {
    name: 'onboarding · welcome',
    route: '/onboarding',
    spec: '§2 First run',
    firstRun: true,
    reach: async (page) => {
      await page.goto('/onboarding')
      await expect(page.getByText("¡Hola! I'm Loro")).toBeVisible()
    },
  },
  {
    name: 'onboarding · packs step',
    route: '/onboarding',
    spec: '§2 First run',
    firstRun: true,
    reach: async (page) => {
      await page.goto('/onboarding')
      await click(page, "Let's go →")
      for (const answer of [/A trip coming up/, /Starting out/, /10 minutes/]) {
        await page.getByRole('radio', { name: answer }).click()
        await click(page, 'Continue')
      }
      await expect(page.getByRole('checkbox', { name: /Café & ordering/ })).toBeVisible()
    },
  },
  {
    name: 'progress · zero state',
    route: '/progress',
    spec: '§15 Progress',
    reach: (page) => open(page, 'Progress'),
  },
  {
    name: 'progress · with a tagged phrase',
    route: '/progress',
    spec: '§15 Progress, tag rollup',
    reach: async (page) => {
      await openFirstPhrase(page)
      await page.getByRole('checkbox', { name: 'Hard to remember' }).click()
      await back(page)
      await open(page, 'Progress')
      await expect(page.getByRole('button', { name: /Hard to remember, 1 phrases/ })).toBeVisible()
    },
  },
  { name: 'add · discover', route: '/add', spec: '§3 Add', reach: (page) => open(page, 'Add') },
  {
    name: 'add · browse grid',
    route: '/add',
    spec: '§3 Add, browse',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'browse')
    },
  },
  {
    name: 'add · theme drilled',
    route: '/add',
    spec: '§3 Add, browse',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'browse')
      await page.getByRole('button', { name: /^Dining,/ }).click()
      await expect(page.getByRole('button', { name: 'Back to themes' })).toBeVisible()
    },
  },
  {
    name: 'add · difficulty sheet',
    route: '/add',
    spec: '§3 Add, tagging sheet',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('button', { name: /¿Tienen una mesa para dos/ }).click()
      await expect(page.getByText('How hard is it for you?')).toBeVisible()
      // Wait for the SETTLED sheet, not a frame of the slide-in: react-native-web's `Modal`
      // renders `aria-modal="true"` at once but only adds `role="dialog"` when the show
      // animation completes (`Modal/ModalContent.js:57-59`).
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    name: 'add · no matches',
    route: '/add',
    spec: '§3 Add, empty search',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('textbox', { name: 'Search phrases' }).fill('not in this catalog')
      await expect(page.getByText('No matches in the library')).toBeVisible()
    },
  },
  {
    name: 'phrase detail',
    route: '/phrase/[id]',
    spec: '§4 Phrase detail',
    reach: (page) => openFirstPhrase(page),
  },
  {
    name: 'phrase detail · edited',
    route: '/phrase/[id]',
    spec: '§4 Phrase detail, edits',
    reach: async (page) => {
      await openFirstPhrase(page)
      await page.getByRole('radio', { name: 'Difficult' }).click()
      await page.getByRole('checkbox', { name: 'Pronunciation' }).click()
    },
  },
  {
    name: 'phrase detail · unknown id',
    route: '/phrase/[id]',
    spec: '§4 Phrase detail, not found',
    // `firstRun` because this is the one state a fresh navigation is the honest way to
    // reach: a deep link to a row that does not exist. Onboarding first would be undone by
    // the navigation anyway.
    firstRun: true,
    reach: async (page) => {
      await page.goto('/phrase/not-a-row-id')
      await expect(page.getByText('No phrase selected')).toBeVisible()
    },
  },
  {
    name: 'stream · first phrase',
    route: '/practice/stream',
    spec: '§12 Adaptive stream',
    reach: (page) => open(page, 'Stream'),
  },
  {
    name: 'stream · all learned',
    route: '/practice/stream',
    spec: '§12 Adaptive stream, empty',
    reach: async (page) => {
      await open(page, 'Stream')
      for (let i = 0; i < 10; i += 1) await click(page, 'Mark learned')
      await expect(page.getByText('Your stream is empty')).toBeVisible()
    },
  },
  {
    name: 'refrain · first rep',
    route: '/practice/refrain',
    spec: '§13 The refrain',
    reach: (page) => open(page, 'Start the wave →'),
  },
  {
    name: 'refrain · locked in',
    route: '/practice/refrain',
    spec: '§13 The refrain, lock-in',
    reach: async (page) => {
      await open(page, 'Start the wave →')
      await lockIn(page)
    },
  },
  {
    name: 'refrain · set complete',
    route: '/practice/refrain',
    spec: '§13 The refrain, completion',
    reach: async (page) => {
      await open(page, 'Start the wave →')
      for (let phrase = 0; phrase < 5; phrase += 1) {
        for (const rep of REFRAIN_REPS) await click(page, rep)
        await page.getByRole('button', { name: /Next phrase →|Finish the set →/ }).click()
      }
      await expect(page.getByText('¡Hecho! Today is done')).toBeVisible()
    },
  },
  {
    name: 'refrain · tag drill',
    route: '/practice/refrain',
    spec: '§13 The refrain, tag drill',
    reach: async (page) => {
      await openFirstPhrase(page)
      await page.getByRole('checkbox', { name: 'Hard to remember' }).click()
      await back(page)
      await open(page, 'Progress')
      await page.getByRole('button', { name: /Hard to remember, 1 phrases/ }).click()
      await expect(page.getByRole('alert')).toContainText('Drilling')
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Put the app into `state`, onboarding first unless the state is part of first run.
 *
 * Every state-driven suite goes through here, so "how do I get to the tagging sheet" has
 * one answer and a change to it lands once.
 */
export async function enter(
  page: Page,
  state: AppState,
  onboard: (page: Page) => Promise<void>,
): Promise<void> {
  if (state.firstRun !== true) await onboard(page)
  await state.reach(page)
}

export async function click(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).click()
}

export async function open(page: Page, name: string): Promise<void> {
  await click(page, name)
}

/** The stack header's back control. Never `page.goto` — the store is in memory. */
export async function back(page: Page): Promise<void> {
  await page.getByRole('link', { name: /back/i }).click()
}

export async function openFirstPhrase(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /percent automatic/ })
    .first()
    .click()
  await expect(page.getByRole('button', { name: 'Practice now →' })).toBeVisible()
}

/** Six reps on the current phrase, which is what lock-in means. */
export async function lockIn(page: Page): Promise<void> {
  for (const rep of REFRAIN_REPS) await click(page, rep)
  await expect(page.getByText('Locked in for today')).toBeVisible()
}

export { REFRAIN_REPS }
