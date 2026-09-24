/**
 * Shared Playwright helpers for learner journeys.
 *
 * `states.ts` remains the manifest: one STATES row still buys a11y, text-scale
 * and coverage. Account mocks stay in `accountFlow.ts`.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { ensureOpenWaveClock } from '../clock'

export const REFRAIN_REPS = [
  'Say it',
  'Chorus it',
  'Faster!',
  'Fill & say',
  'Respond',
  'Say it cold',
] as const

/**
 * Put the app into `state`, onboarding first unless the state is part of first run.
 *
 * Every state-driven suite goes through here, so "how do I get to the tagging sheet" has
 * one answer and a change to it lands once.
 */
export async function enter(
  page: Page,
  state: { firstRun?: true; reach: (page: Page) => Promise<void> },
  onboard: (page: Page) => Promise<void>,
): Promise<void> {
  // Specs that need a different instant call `atInstant` first. The default morning
  // clock keeps Today naming the morning slot; waves no longer lock practice.
  await ensureOpenWaveClock(page)
  // The exhaustive geometry suites reuse one browser page. Each manifest entry is
  // an independent learner, while production reloads now correctly retain progress.
  if (page.url().startsWith('http')) {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.goto('about:blank')
  }
  if (state.firstRun !== true) await onboard(page)
  await state.reach(page)
}

export async function click(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).click()
}

/** The Field contract: the textbox accessible name is the label. */
export async function fillField(page: Page, name: string, value: string): Promise<void> {
  await page.getByRole('textbox', { name }).fill(value)
}

export async function open(page: Page, name: string): Promise<void> {
  await click(page, name)
}

/** Stream's focused 280 now-playing presentation. Landing is the editorial list. */
export async function openNowPlaying(page: Page): Promise<void> {
  const openPlayer = page.getByRole('button', { name: 'Open now playing', exact: true })
  if ((await openPlayer.count()) > 0) await openPlayer.click()
  await expect(page.getByRole('button', { name: 'Dismiss player', exact: true })).toBeVisible()
}

/** Simple-queue dressing. Does not replace `/practice/stream` editorial landing. */
export async function openSimpleQueue(page: Page): Promise<void> {
  await page.goto('/practice/stream?queue=simple')
  await expect(page.getByTestId('stream-simple-hero')).toBeVisible()
  await expect(page.getByTestId('stream-editorial-hero')).toHaveCount(0)
}

/** Vertical mouse drag between simple-queue reorder handles. Short/horizontal stays inert. */
export async function dragListenReorder(page: Page, from: number, to: number): Promise<void> {
  const handles = page.getByTestId('stream-queue-reorder')
  const start = await handles.nth(from).boundingBox()
  const end = await handles.nth(to).boundingBox()
  if (start === null || end === null) throw new Error('Missing listen-queue reorder handle')
  const fromX = start.x + start.width / 2
  const fromY = start.y + start.height / 2
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 16 })
  await page.mouse.up()
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
 * Two real FSRS schedules via Refrain. The caller jumps the clock so Review
 * sees both as due — this does not invent a first schedule.
 */
export async function scheduleTwoReviewPhrases(page: Page): Promise<void> {
  await lockIn(page)
  await click(page, 'Next phrase →')
  await click(page, 'Say it')
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
  // Expo Router retains an exiting screen briefly for its transition. The app-visible tree has
  // one Today list, but react-native-web can retain a duplicate DOM node until that transition
  // completes, so use the stable entering list for immediate post-exit assertions.
  return page.locator('[data-testid="today-day-list"]:visible')
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
 * The wording stays "N days" (`Navigation.dc.html:118`). v1.2 adds a decorative flame sibling
 * when the count is real; this locator matches the day-count text only. Nothing else on Today
 * reads as a day count: the day list's own numbers are times, "N reps today", and "day N/4".
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
 * Scoped to the visible day list: the v1.2 header also prints the same count, and returning
 * from Refrain can leave a popped copy in the DOM.
 */
export function repsTodayRow(page: Page, reps: number): Locator {
  return todayMarker(page).getByText(`${reps} reps today`, { exact: true })
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
