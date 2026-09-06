import { localeText, onboardPair } from './languageFlow'
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

import { expect, type Locator, type Page } from '@playwright/test'

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
  ...(['bg', 'ru'] as const).flatMap((native) =>
    (['today', 'stream', 'add', 'progress', 'refrain'] as const).map((surface): AppState => ({
      name: `${surface} · ${native} course`,
      route:
        surface === 'today'
          ? '/'
          : surface === 'stream' || surface === 'refrain'
            ? `/practice/${surface}`
            : `/${surface}`,
      firstRun: true,
      spec: '§ F-08 Languages',
      reach: async (page) => {
        const text = localeText[native]
        await onboardPair(page, native, native === 'bg' ? 'ru-RU' : 'bg-BG')
        if (surface === 'stream') {
          await page.getByRole('button', { name: new RegExp(`^${text['common.stream']},`) }).click()
          await expect(page.getByText(text['stream.audioNote'])).toBeVisible()
        } else if (surface === 'add') {
          await page.getByRole('button', { name: text['today.rail.add'], exact: true }).click()
          await page
            .getByRole('button')
            .filter({ has: page.locator('[lang="bg-BG"], [lang="ru-RU"]') })
            .first()
            .click()
          await expect(
            page.getByRole('button', { name: text['add.confirm'], exact: true }),
          ).toBeVisible()
          await expect(page.getByRole('dialog')).toBeVisible()
        } else if (surface === 'progress') {
          await page.getByRole('button', { name: text['common.progress'], exact: true }).click()
          await expect(page.getByText(text['progress.mastery.title'])).toBeVisible()
        } else if (surface === 'refrain') {
          const names = [
            text['today.cta.startWave.morning'],
            text['today.cta.startWave.midday'],
            text['today.cta.startWave.evening'],
          ]
          await page.getByRole('button', { name: new RegExp(names.join('|')) }).click()
          await expect(page.getByText(text['refrain.audioNote'])).toBeVisible()
        }
      },
    })),
  ),
  {
    name: 'languages · selection',
    route: '/languages',
    spec: '§ F-08 Languages',
    reach: async (page) => {
      await page.getByRole('button', { name: /Today, open the menu/ }).click()
      await page.getByRole('button', { name: 'Languages', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Save languages' })).toBeVisible()
    },
  },
  {
    name: 'languages · invalid matching pair',
    route: '/languages',
    spec: '§ F-08 Languages',
    reach: async (page) => {
      await page.getByRole('button', { name: /Today, open the menu/ }).click()
      await page.getByRole('button', { name: 'Languages', exact: true }).click()
      await page
        .getByRole('radiogroup', { name: 'I want to learn' })
        .getByRole('radio', { name: 'Български' })
        .click()
      await page
        .getByRole('radiogroup', { name: 'My native language' })
        .getByRole('radio', { name: 'Български' })
        .click()
      await expect(page.getByText('Choose a different learning language.')).toBeVisible()
    },
  },
  ...(['bg', 'ru'] as const).map((locale): AppState => ({
    name: `onboarding · ${locale} languages`,
    route: '/onboarding',
    firstRun: true,
    spec: '§ F-08 Languages',
    reach: async (page) => {
      await page.goto('/onboarding')
      await page
        .getByRole('radiogroup', { name: 'My native language' })
        .getByRole('radio', { name: locale === 'bg' ? 'Български' : 'Русский' })
        .click()
      await expect(
        page.getByText(locale === 'bg' ? 'Моят роден език' : 'Мой родной язык'),
      ).toBeVisible()
    },
  })),
  {
    name: 'today · seeded',
    route: '/',
    spec: '§11 Today',
    reach: (page) => expect(todayMarker(page)).toBeVisible(),
  },
  {
    name: 'today · switcher',
    route: '/',
    spec: '§11 Today, the navigation spine',
    reach: async (page) => {
      await page.getByRole('button', { name: /Today, open the menu/ }).click()
      await expect(page.getByText('Where to?')).toBeVisible()
      // The SETTLED sheet, not a frame of the slide-in — see `add · difficulty sheet`.
      await expect(page.getByRole('dialog')).toBeVisible()
    },
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
    // The undo window is a learner-visible state of its own: a toast with an affordance in it,
    // living on Today because `Remove` navigates back before the toast expires (`P2-13`).
    name: 'today · remove undo offered',
    route: '/',
    spec: '§3 Phrase detail, remove',
    reach: async (page) => {
      await openFirstPhrase(page)
      await click(page, 'Remove')
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    },
  },
  {
    name: 'onboarding · welcome',
    route: '/onboarding',
    spec: '§1 Onboarding',
    firstRun: true,
    reach: async (page) => {
      await page.goto('/onboarding')
      await expect(page.getByText("¡Hola! I'm Loro")).toBeVisible()
    },
  },
  {
    name: 'onboarding · packs step',
    route: '/onboarding',
    spec: '§1 Onboarding',
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
      // `getByLabel`, not `getByRole('button')`: the row is a rollup, not a control. The tag
      // drill it used to claim does not exist (plan 64 §4).
      await expect(trickyRow(page, 'Hard to remember', 1)).toBeVisible()
    },
  },
  { name: 'add · discover', route: '/add', spec: '§2 Add', reach: (page) => open(page, 'Add') },
  {
    name: 'add · browse grid',
    route: '/add',
    spec: '§2 Add, browse',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'browse')
    },
  },
  {
    name: 'add · theme drilled',
    route: '/add',
    spec: '§2 Add, browse',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'browse')
      await page.getByRole('button', { name: /^Dining,/ }).click()
      await expect(page.getByRole('button', { name: 'Back to themes' })).toBeVisible()
      await expect(page.getByText('Dining · 4 left')).toBeVisible()
    },
  },
  {
    // The other end of a drill: a theme the learner already owns in full. Onboarding seeds
    // every Café phrase in the catalog, so this is one tap from the grid.
    name: 'add · theme fully added',
    route: '/add',
    spec: '§2 Add, browse',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'browse')
      await page.getByRole('button', { name: /^Café,/ }).click()
      await expect(page.getByText(/You have every phrase in this theme/)).toBeVisible()
    },
  },
  {
    name: 'add · difficulty sheet',
    route: '/add',
    spec: '§2 Add, tagging sheet',
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
    spec: '§2 Add, empty search',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('textbox', { name: 'Search phrases' }).fill('not in this catalog')
      await expect(page.getByText('No matches in the library')).toBeVisible()
    },
  },
  {
    name: 'phrase detail',
    route: '/phrase/[id]',
    spec: '§3 Phrase detail',
    reach: (page) => openFirstPhrase(page),
  },
  {
    name: 'phrase detail · edited',
    route: '/phrase/[id]',
    spec: '§3 Phrase detail, edits',
    reach: async (page) => {
      await openFirstPhrase(page)
      await page.getByRole('radio', { name: 'Difficult' }).click()
      await page.getByRole('checkbox', { name: 'Pronunciation' }).click()
    },
  },
  {
    name: 'phrase detail · unknown id',
    route: '/phrase/[id]',
    spec: '§3 Phrase detail, not found',
    // `firstRun` because this is the one state a fresh navigation is the honest way to
    // reach: a deep link to a row that does not exist. Onboarding first would be undone by
    // the navigation anyway.
    firstRun: true,
    reach: async (page) => {
      await page.goto('/phrase/not-a-row-id')
      await expect(page.getByText('No phrase selected')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Go to Today' })).toBeVisible()
    },
  },
  {
    name: 'stream · first phrase',
    route: '/practice/stream',
    spec: '§4 Adaptive stream; plan 84 manual browsing while audio is unavailable',
    reach: (page) => open(page, 'Stream'),
  },
  {
    name: 'stream · all learned',
    route: '/practice/stream',
    spec: '§4 Adaptive stream, empty',
    reach: async (page) => {
      await open(page, 'Stream')
      for (let i = 0; i < 10; i += 1) await click(page, 'Mark learned')
      await expect(page.getByText('Your stream is empty')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add phrases', exact: true })).toBeVisible()
    },
  },
  {
    name: 'refrain · first rep',
    route: '/practice/refrain',
    spec: '§12 The refrain',
    reach: (page) => startWave(page),
  },
  {
    name: 'refrain · locked in',
    route: '/practice/refrain',
    spec: '§12 The refrain, lock-in',
    reach: async (page) => {
      await startWave(page)
      await lockIn(page)
      await expect(page.getByText("Today's practice rounds are complete.")).toBeVisible()
      await expect(page.getByText('effort ↓', { exact: true })).toHaveCount(0)
    },
  },
  {
    name: 'refrain · set complete',
    route: '/practice/refrain',
    spec: '§12 The refrain, completion',
    reach: async (page) => {
      await startWave(page)
      for (let phrase = 0; phrase < 5; phrase += 1) {
        for (const rep of REFRAIN_REPS) await click(page, rep)
        await page.getByRole('button', { name: /Next phrase →|Finish the set →/ }).click()
      }
      await expect(page.getByText('¡Hecho! Today is done')).toBeVisible()
    },
  },
  ...[
    {
      name: 'languages · cold entry',
      route: '/languages',
      url: '/languages',
      spec: '§ F-08 Languages',
    },
    { name: 'add · cold entry', route: '/add', url: '/add', spec: '§2 Add' },
    { name: 'progress · cold entry', route: '/progress', url: '/progress', spec: '§15 Progress' },
    {
      name: 'stream · cold entry',
      route: '/practice/stream',
      url: '/practice/stream',
      spec: '§4 Adaptive stream',
    },
    {
      name: 'refrain · cold entry',
      route: '/practice/refrain',
      url: '/practice/refrain',
      spec: '§12 The refrain',
    },
    {
      name: 'phrase detail · cold entry',
      route: '/phrase/[id]',
      url: '/phrase/missing',
      spec: '§3 Phrase detail',
    },
  ].map(({ name, route, url, spec }): AppState => ({
    name,
    route,
    spec,
    firstRun: true,
    reach: async (page) => {
      await page.goto(url)
      await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
    },
  })),
  ...[
    {
      name: 'languages · switcher',
      route: '/languages',
      url: '/languages',
      spec: '§ F-08 Languages',
    },
    { name: 'add · switcher', route: '/add', url: '/add', spec: '§2 Add' },
    { name: 'progress · switcher', route: '/progress', url: '/progress', spec: '§15 Progress' },
    {
      name: 'stream · switcher',
      route: '/practice/stream',
      url: '/practice/stream',
      spec: '§4 Adaptive stream',
    },
    {
      name: 'refrain · switcher',
      route: '/practice/refrain',
      url: '/practice/refrain',
      spec: '§12 The refrain',
    },
    {
      name: 'phrase detail · switcher',
      route: '/phrase/[id]',
      url: '/phrase/missing',
      spec: '§3 Phrase detail',
    },
  ].map(({ name, route, url, spec }): AppState => ({
    name,
    route,
    spec,
    firstRun: true,
    reach: async (page) => {
      await page.goto(url)
      await page.getByRole('button', { name: /, open the menu$/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  })),
  {
    name: 'onboarding · ready summary',
    route: '/onboarding',
    spec: '§1 Onboarding, ready',
    firstRun: true,
    reach: async (page) => {
      await page.goto('/onboarding')
      await click(page, "Let's go →")
      for (const answer of [/A trip coming up/, /Starting out/, /10 minutes/]) {
        await page.getByRole('radio', { name: answer }).click()
        await click(page, 'Continue')
      }
      await page.getByRole('checkbox', { name: /Café & ordering/ }).click()
      await click(page, 'Continue')
      await expect(page.getByText('A trip coming up', { exact: true })).toBeVisible()
      await expect(page.getByText("You're all set")).toBeVisible()
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

/**
 * Today's single filled control. It NAMES the wave the clock is on
 * (`Navigation.dc.html:159–161`), so specs match the shape rather than the hour CI runs at.
 */
export const START_WAVE = /^Start the (morning|midday|evening) wave$/

export async function startWave(page: Page): Promise<void> {
  await page.getByRole('button', { name: START_WAVE }).click()
}

/**
 * Proof that Today is on screen.
 *
 * Not `getByText('Today')`: the v1.1 shell says the word twice, once in the spine and once as
 * the header title, so that locator is a strict-mode violation. The day list's heading is the
 * one thing only this screen has.
 */
export function todayMarker(page: Page): Locator {
  return page.getByText('Your day', { exact: true })
}

/** One rep, from Today and back to Today. */
export async function doOneRep(page: Page): Promise<void> {
  await startWave(page)
  await click(page, 'Say it')
  await page.goBack()
  await expect(todayMarker(page)).toBeVisible()
}

export async function openProgress(page: Page): Promise<void> {
  await click(page, 'Progress')
  await expect(page).toHaveURL(/\/progress$/)
}

export async function backToToday(page: Page): Promise<void> {
  await back(page)
  await expect(todayMarker(page)).toBeVisible()
}

/**
 * A `StatTile`'s value, by its accessible name.
 *
 * `StatTile` groups its number and label into one labelled node
 * (`src/ui/primitives.tsx`), which is why this is `getByLabel` and not a walk up the DOM
 * looking for whichever child holds the number.
 */
export function statTile(page: Page, label: string, value: number | string): Locator {
  return page.getByLabel(`${label}: ${String(value)}`)
}

/** The big streak number on Progress — `—` before the first rep, the count after it. */
export function streakValue(page: Page): Locator {
  return page
    .getByText('Current streak')
    .locator('..')
    .getByText(/^\d+$|^—$/)
    .first()
}

/**
 * Today's streak capsule — `—` before the first rep, "N days" after it.
 *
 * The v1.1 root header words the streak rather than pairing a bare number with a flame
 * (`Navigation.dc.html:118`), so this matches the wording. Nothing else on Today reads as a day
 * count: the day list's own numbers are times, "N reps today", and "day N/4".
 */
export function streakChip(page: Page): Locator {
  return page.getByText(/^(\d+ days?|—)$/)
}

/** The streak capsule's copy, for a given number of practised days. */
export function streakText(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`
}

/**
 * A fact row in Today's day list whose number sits in the time column, so the row carries a
 * grouped accessible name: the banked tail is `getByLabel('1 graduated and banked')`.
 */
export function bankedRow(page: Page, graduated: number): Locator {
  return page.getByLabel(`${graduated} graduated and banked`)
}

/**
 * The day list's reps-so-far row, which replaced Today's "reps today" stat tile.
 *
 * Filtered to the visible node: returning to Today from the Refrain leaves the popped screen's
 * copy of it in the DOM, and `refrain.spec.ts` already filters the same way for that reason.
 */
export function repsTodayRow(page: Page, reps: number): Locator {
  return page.getByText(`${reps} reps today`, { exact: true }).filter({ visible: true })
}

/** A rail destination that carries a count — "Stream, 10 phrases". */
export function railCount(page: Page, label: string, phrases: number): Locator {
  return page.getByRole('button', { name: `${label}, ${phrases} phrases` })
}

/**
 * A "what's tricky" row on Progress, by its grouped accessible name.
 *
 * `getByLabel`, not `getByRole('button')`: the row is a ROLLUP. It used to be a control that
 * toasted "Drilling N …" and navigated to today's unfiltered set, which named a consequence that
 * did not happen; the tag-filtered session is plan 64 §4. So a change that makes this a button
 * again should be the change that makes the drill real.
 */
export function trickyRow(page: Page, label: string, phrases: number): Locator {
  return page.getByLabel(`${label}, ${phrases} phrases`)
}

export { REFRAIN_REPS }
