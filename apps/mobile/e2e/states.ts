import { reachAccount } from './accountFlow'
import { mockTtsStatus } from './learnerApiFlow'
import { localeText, onboardPair } from './languageFlow'
import { openListenExport, openListenScenario, LISTEN_SCENARIOS, LISTEN_STATUS } from './listenFlow'
import { openMusic, openMusicFixture, selectThreePhrases } from './musicFlow'
import { openStorageFailure, openStorageLoading } from './persistenceFlow'
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
import {
  REFRAIN_REPS,
  back,
  click,
  lockIn,
  open,
  openFirstPhrase,
  startHardRefrain,
  startRefrain,
  todayMarker,
  trickyRow,
} from './helpers'

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
    name: 'today · paused Refrain resume',
    route: '/',
    spec: 'NAV-13/NAV-14 pause and course-preserving resume',
    reach: async (page) => {
      await startRefrain(page)
      await expect(page.getByRole('button', { name: 'Say it', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Leave practice', exact: true }).click()
      await page.getByRole('button', { name: 'Pause the wave', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()
    },
  },
  {
    name: 'more · built destinations',
    route: '/more',
    spec: 'NAV-01/NAV-08 built destination reachability',
    reach: async (page) => {
      await page.getByRole('button', { name: /, open the menu$/ }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'More', exact: true }).click()
      await expect(page.getByText('Phrases', { exact: true })).toBeVisible()
      await expect(page.getByText('Practice', { exact: true })).toBeVisible()
      await expect(page.getByText('You', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Languages', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Phrase songs', exact: true })).toBeVisible()
    },
  },
  {
    name: 'listen-export · honest unavailable',
    route: '/listen-export',
    spec: 'AS-07 Batch phrase listening export',
    reach: async (page) => {
      await openListenExport(page)
      await expect(page.getByText(LISTEN_STATUS['not-configured'], { exact: true })).toBeVisible()
      await expect(page.getByText('Sara Martin 1')).toBeVisible()
      await expect(page.getByText('Dante', { exact: true })).toBeVisible()
    },
  },
  ...LISTEN_SCENARIOS.map((scenario) => ({
    name: `listen-export · ${scenario}`,
    route: '/listen-export',
    spec: 'AS-07 Batch phrase listening export',
    reach: async (page: Page) => {
      await openListenScenario(page, scenario)
      await expect(page.getByText(LISTEN_STATUS[scenario], { exact: true })).toBeVisible()
    },
  })),
  {
    name: 'settings · durable visual and privacy preferences',
    route: '/settings',
    spec: 'F-05/F-06 local settings',
    reach: async (page) => {
      await page.getByRole('button', { name: /, open the menu$/ }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(page.getByRole('radiogroup', { name: 'Accent colour' })).toBeVisible()
      await expect(page.getByRole('checkbox', { name: 'Share anonymous analytics' })).toBeVisible()
    },
  },
  {
    name: 'storage · opening progress',
    route: '/',
    firstRun: true,
    spec: 'F-02 durable hydration',
    reach: openStorageLoading,
  },
  {
    name: 'storage · recovery preserves data',
    route: '/',
    firstRun: true,
    spec: 'F-02 non-destructive migration recovery',
    reach: openStorageFailure,
  },
  ...(
    [
      'discoveryError',
      'unavailable',
      'ready',
      'busy',
      'error',
      'cancelled',
      'signedIn',
      'localSignOut',
      'email',
      'code',
      'connected',
      'invalid-code',
      'sync-unavailable',
      'sync-rejected',
      'signed-out',
    ] as const
  ).map((scenario): AppState => ({
    name: `account · ${scenario}`,
    route: '/account',
    spec: 'F-01/F-04 optional sign-in and sync',
    reach: async (page) => {
      await reachAccount(page, scenario)
    },
  })),
  ...(['initial', 'partial', 'revealed'] as const).map((step): AppState => ({
    name: `speak · ${step} reveal`,
    route: '/practice/speak',
    spec: 'P3-25 on-device speech reveal fallback',
    reach: async (page) => {
      await page.getByRole('button', { name: /, open the menu$/ }).click()
      await page.getByRole('button', { name: 'Speak', exact: true }).click()
      const reveal = page.getByRole('button', { name: 'Reveal a word', exact: true })
      await expect(reveal).toBeVisible()
      if (step !== 'initial') await reveal.click()
      if (step === 'revealed') {
        while (await reveal.isEnabled()) await reveal.click()
        await expect(page.getByText('Phrase revealed. Try saying it aloud.')).toBeVisible()
      }
    },
  })),
  {
    name: 'speak · empty',
    route: '/practice/speak',
    firstRun: true,
    spec: 'P3-25 empty practice',
    reach: async (page) => {
      await page.goto('/practice/speak')
      await expect(page.getByRole('button', { name: 'Add phrases', exact: true })).toBeVisible()
    },
  },
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
          await page
            .getByRole('button', { name: text['stream.practiceRefrain'], exact: true })
            .click()
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
    name: 'add · oversized import',
    route: '/add',
    spec: '§2 Add, bounded Import recovery',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'import')
      await page
        .getByRole('textbox', { name: 'Phrases to import' })
        .fill(Array.from({ length: 51 }, (_, index) => `Hola ${index} | Hi`).join('\n'))
      await click(page, 'Review phrases')
      await expect(page.getByRole('alert')).toContainText('Your text is still here')
    },
  },
  {
    name: 'add · import review',
    route: '/add',
    spec: '§2 Add, reviewed Import',
    reach: async (page) => {
      await open(page, 'Add')
      await click(page, 'import')
      await page
        .getByRole('textbox', { name: 'Phrases to import' })
        .fill('¿Dónde está la estación? | Where is the station?')
      await click(page, 'Review phrases')
      await expect(page.getByRole('button', { name: 'Add 1 reviewed phrase' })).toBeVisible()
    },
  },
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
      await expect(page.getByText('Add your own')).toBeVisible()
    },
  },
  {
    name: 'add · discover own',
    route: '/add',
    spec: '§2 Add, add your own sheet',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('textbox', { name: 'Search phrases' }).fill('not in this catalog')
      await page.getByRole('button', { name: /Add .* as your own phrase/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Phrase to add' })).toBeVisible()
    },
  },
  {
    name: 'add · discover generating',
    route: '/add',
    spec: '§2 Add, suggested loading',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('textbox', { name: 'Search phrases' }).fill('pharmacy')
      await expect(
        page.getByText('Looking for phrases…').or(page.getByText('Suggested for this')),
      ).toBeVisible()
    },
  },
  {
    name: 'add · discover suggested',
    route: '/add',
    spec: '§2 Add, suggested garnish',
    reach: async (page) => {
      await open(page, 'Add')
      await page.getByRole('textbox', { name: 'Search phrases' }).fill('pharmacy')
      await expect(page.getByText('Suggested for this')).toBeVisible()
      await expect(page.getByRole('button', { name: /farmacia de guardia/ })).toBeVisible()
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
    name: 'stream · server voice',
    route: '/practice/stream',
    spec: '§4 Adaptive stream; AS-01 API reference TTS when GET /tts/status is ready',
    reach: async (page) => {
      mockTtsStatus(page, true)
      await open(page, 'Stream')
      await expect(page.getByRole('button', { name: 'Play phrase', exact: true })).toBeVisible()
      await expect(page.getByText('Server voice · generated for this phrase')).toBeVisible()
    },
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
    reach: (page) => startRefrain(page),
  },
  {
    name: 'refrain · locked in',
    route: '/practice/refrain',
    spec: '§12 The refrain, lock-in',
    reach: async (page) => {
      await startRefrain(page)
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
      await startHardRefrain(page)
      for (let phrase = 0; phrase < 5; phrase += 1) {
        for (const rep of REFRAIN_REPS) await click(page, rep)
        await page.getByRole('button', { name: /Next phrase →|Finish the set →/ }).click()
      }
      await expect(page.getByText('¡Hecho! These phrases are done')).toBeVisible()
      await expect(page.getByText('Difficult phrases are warmed up')).toBeVisible()
    },
  },
  {
    name: 'refrain · phrase complete',
    route: '/practice/refrain',
    spec: '§12 The refrain, targeted completion',
    reach: async (page) => {
      await startRefrain(page)
      await lockIn(page)
      await page.getByRole('button', { name: 'Finish the set →' }).click()
      await expect(page.getByText('This phrase is warmed up')).toBeVisible()
      await expect(page.getByText('¡Hecho! Today is done')).toHaveCount(0)
    },
  },
  {
    name: 'refrain · no difficult phrases',
    route: '/practice/refrain',
    spec: '§12 The refrain, difficult-only menu entry',
    reach: async (page) => {
      await page.getByRole('button', { name: /, open the menu$/ }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'The Refrain' }).click()
      await expect(page.getByText('No difficult phrases yet')).toBeVisible()
    },
  },
  {
    name: 'refrain · difficult only',
    route: '/practice/refrain',
    spec: '§12 The refrain, difficult-only menu entry',
    reach: async (page) => {
      await startHardRefrain(page)
      await expect(page.getByText('Phrase 1 / 5')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Say it' })).toBeVisible()
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
  {
    name: 'music · empty selection',
    route: '/music',
    spec: 'plan 96 P3F-01 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusic(page)
      await expect(page.getByText('Select at least three catalog phrases.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Write lyrics', exact: true })).toBeDisabled()
    },
  },
  {
    name: 'music · phrases selected',
    route: '/music',
    spec: 'plan 96 P3F-01 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusic(page)
      await selectThreePhrases(page)
      await expect(page.getByText('3 phrases selected')).toBeVisible()
    },
  },
  {
    name: 'music · lyrics ready',
    route: '/music',
    spec: 'plan 96 P3F-05 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'lyrics')
      await expect(page.getByText('Review the lyrics')).toBeVisible()
    },
  },
  {
    name: 'music · lyrics fallback',
    route: '/music',
    spec: 'plan 96 P3F-06 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusic(page)
      await selectThreePhrases(page)
      await page.getByRole('button', { name: 'Write lyrics', exact: true }).click()
      await expect(
        page.getByText('Sing-along card — a bundled lyric floor, not a generated AI song.'),
      ).toBeVisible()
    },
  },
  {
    name: 'music · generating',
    route: '/music',
    spec: 'plan 96 P3F-09 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'generating')
      await expect(
        page.getByRole('button', { name: 'Making your songs', exact: true }),
      ).toBeVisible()
    },
  },
  {
    name: 'music · partial styles',
    route: '/music',
    spec: 'plan 96 P3F-09 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'partial')
      await expect(page.getByText('Some styles are ready. Others could not be made.')).toBeVisible()
    },
  },
  {
    name: 'music · playing',
    route: '/music',
    spec: 'plan 96 P3F-03 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'playing')
      await expect(page.getByText('Generated song — not a pronunciation model')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Pause generated song', exact: true }),
      ).toBeVisible()
    },
  },
  {
    name: 'music · unavailable',
    route: '/music',
    spec: 'plan 96 P3F-06 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'unavailable')
      await expect(
        page.getByText(
          'Song generation needs a connection. You can still pick phrases and keep these lyrics.',
        ),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Make the songs', exact: true })).toBeDisabled()
    },
  },
  {
    name: 'music · provider error',
    route: '/music',
    spec: 'plan 96 P3F-09 / AI-05 phrase-song garnish',
    reach: async (page) => {
      await openMusicFixture(page, 'error')
      await expect(
        page.getByText('Those styles could not be made. Your lyrics are still here.'),
      ).toBeVisible()
    },
  },
]
