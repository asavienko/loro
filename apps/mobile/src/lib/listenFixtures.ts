import { LISTENING_REPEATS_DEFAULT, type ListeningBlocker } from '@loro/core'
import { listenViewModel, type ListenPhase, type ListenProgress, type ListenViewModel } from './listenCompanion'

/** Keep in lockstep with `e2e/listenFlow.ts`. Playwright cannot import this file. */
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

export function isListenScenario(value: unknown): value is ListenScenario {
  return typeof value === 'string' && LISTEN_SCENARIOS.some((scenario) => scenario === value)
}

/** Dev/E2E snapshots only. Production and release web ignore `?listen=`. */
export function listenScenarioFromSearch(value: unknown): ListenScenario | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null
  const raw: unknown = Array.isArray(value) ? value[0] : value
  return isListenScenario(raw) ? raw : null
}

const emptyProgress: ListenProgress = { done: 0, total: 0, failed: 0 }

function base(changes: Partial<Parameters<typeof listenViewModel>[0]> & { phase: ListenPhase }): ListenViewModel {
  return listenViewModel({
    locale: 'es-ES',
    phrases: [{ id: 'row-1', targetText: 'Un café, por favor.', learnerAuthored: false }],
    repeats: LISTENING_REPEATS_DEFAULT,
    network: true,
    configured: true,
    nativeCache: true,
    sessionBusy: false,
    diskFull: false,
    quotaExceeded: false,
    cacheComplete: false,
    progress: emptyProgress,
    durationMs: null,
    ...changes,
  })
}

/** Dev/E2E snapshots of honest composer states. Production ignores `?listen=`. */
export function fixtureListenView(scenario: ListenScenario): ListenViewModel {
  const fixtureBlockers: Record<ListenScenario, readonly ListeningBlocker[]> = {
    empty: ['empty'],
    'needs-network': ['needs-network'],
    generating: [],
    'partial-failure': [],
    'ready-to-listen': [],
    playing: [],
    'share-unavailable': [],
    'share-ready': [],
    cancelled: [],
    'disk-full': ['disk-full'],
    'session-busy': ['session-busy'],
    'voices-unapproved': ['voices-unapproved', 'model-unpinned'],
    'voices-single': ['voices-single'],
    quota: ['quota'],
    'not-configured': ['not-configured'],
  }
  const phase: Record<ListenScenario, ListenPhase> = {
    empty: 'idle',
    'needs-network': 'idle',
    generating: 'generating',
    'partial-failure': 'partial',
    'ready-to-listen': 'ready',
    playing: 'playing',
    'share-unavailable': 'ready',
    'share-ready': 'ready',
    cancelled: 'cancelled',
    'disk-full': 'error',
    'session-busy': 'idle',
    'voices-unapproved': 'idle',
    'voices-single': 'idle',
    quota: 'idle',
    'not-configured': 'idle',
  }
  const view = base({
    phase: phase[scenario],
    phrases:
      scenario === 'empty'
        ? []
        : [{ id: 'row-1', targetText: 'Un café, por favor.', learnerAuthored: false }],
    network: scenario !== 'needs-network',
    configured: scenario !== 'not-configured',
    nativeCache: scenario !== 'not-configured',
    sessionBusy: scenario === 'session-busy',
    diskFull: scenario === 'disk-full',
    quotaExceeded: scenario === 'quota',
    cacheComplete: scenario === 'ready-to-listen' || scenario === 'playing' || scenario === 'share-ready' || scenario === 'share-unavailable',
    progress:
      scenario === 'generating'
        ? { done: 3, total: 12, failed: 0 }
        : scenario === 'partial-failure'
          ? { done: 8, total: 12, failed: 4 }
          : scenario === 'cancelled'
            ? { done: 5, total: 12, failed: 0 }
            : emptyProgress,
    durationMs: scenario === 'ready-to-listen' || scenario === 'playing' ? 1420 : null,
  })
  return {
    ...view,
    blockers: fixtureBlockers[scenario],
    generateEnabled: false,
    listenEnabled: scenario === 'ready-to-listen' || scenario === 'playing',
    shareEnabled: scenario === 'share-ready',
  }
}
