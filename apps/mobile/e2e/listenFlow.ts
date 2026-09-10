import { expect, type Page } from '@playwright/test'

/** Keep in lockstep with `src/lib/listenFixtures.ts`. E2E must not import app source. */
export const LISTEN_SCENARIOS = [
  'empty',
  'needs-network',
  'generating',
  'partial-failure',
  'ready-to-listen',
  'playing',
  'share-unavailable',
  'share-ready',
  'cancelled',
  'disk-full',
  'session-busy',
  'voices-unapproved',
  'voices-single',
  'quota',
  'not-configured',
] as const

export type ListenScenario = (typeof LISTEN_SCENARIOS)[number]

export const LISTEN_TITLE = 'Listen to your phrases'
export const LISTEN_NAV = 'Listen'
export const LISTEN_GENERATE = 'Generate listening audio'
export const LISTEN_LISTEN = 'Listen from cache'
export const LISTEN_SHARE = 'Share listening file'
export const LISTEN_FIXTURE_NOTE = 'Development snapshot. This is not licensed neural audio.'

export const LISTEN_STATUS: Record<ListenScenario, string> = {
  empty: 'No phrases in this course yet. Add phrases, then come back to listen.',
  'needs-network': 'Connect to generate listening audio. Cached clips still play offline.',
  generating: 'Generating licensed listening takes…',
  'partial-failure': 'Some listening clips failed. Completed clips stayed on this device.',
  'ready-to-listen': 'Ready to listen from the on-device cache.',
  playing: 'Playing cached listening audio.',
  'share-unavailable': 'Sharing licensed listening audio is not available yet.',
  'share-ready': 'Share the concatenated listening file.',
  cancelled: 'Generation cancelled. Completed clips stayed on this device.',
  'disk-full': 'Not enough storage to save listening audio. The last complete batch is unchanged.',
  'session-busy': 'Stop the current audio session before preparing or playing listening audio.',
  'voices-unapproved': 'Licensed listening voices are not approved yet.',
  'voices-single': 'One licensed listening voice is not enough. This companion needs at least two.',
  quota: 'Listening generation is paused because the licensed quota is exhausted.',
  'not-configured': 'Listening generation is not configured on this device.',
}

export async function openListenExport(page: Page): Promise<void> {
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: LISTEN_NAV, exact: true }).click()
  await expect(page).toHaveURL(/\/listen-export/)
  await expect(page.getByText(LISTEN_TITLE)).toBeVisible()
}

export async function openListenScenario(page: Page, scenario: ListenScenario): Promise<void> {
  await page.goto(`/listen-export?listen=${scenario}`)
  await expect(page.getByText(LISTEN_TITLE)).toBeVisible()
  await expect(page.getByText(LISTEN_STATUS[scenario])).toBeVisible()
}
