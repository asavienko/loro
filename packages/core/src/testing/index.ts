/**
 * Fixtures and fakes.
 *
 * NO TEST USES THE REAL CLOCK, REAL RANDOMNESS, OR THE NETWORK. The conformance
 * suite stubs `Date.now` and `Math.random` to *throw*, which is how we know engines
 * are genuinely deterministic rather than accidentally passing.
 */

import type {
  Clock,
  EngineContext,
  LoroCoreFacade,
  PhraseRepository,
  PracticeSettings,
} from '../engines/types.js'
import type { Difficulty, PhraseState, Tag } from '../domain/phrase.js'
import { isActive, isDue, LadderRung } from '../domain/phrase.js'
import { fakeSelectRefrainSet } from './selection.js'
import {
  fixtureAutomaticity,
  fixtureBeatMsForMode,
  fixtureModeForRep,
  fixtureModelRateForMode,
  fixtureRefrainSetSize,
} from './refrainFixtures.js'
import { userPhraseId, catalogPhraseId } from '../domain/ids.js'

/** A fixed instant, so every fixture is reproducible. 2026-07-28T09:41:00Z. */
export const T0 = 1_785_231_660_000

/**
 * `streakDay` defaults to `localDay` — the two only differ between midnight and 04:00,
 * and a test that cares about the grace window should say so by passing it explicitly.
 * Defaulting it to something *else* would make every unrelated fixture depend on the
 * window's exact width.
 */
export function fakeClock(now: number = T0, localDay = '2026-07-28', streakDay = localDay): Clock {
  let current = now
  return {
    now: () => current,
    localDay: () => localDay,
    streakDay: () => streakDay,
    // Test-only escape hatch for advancing time deliberately.
    ...({ advance: (ms: number) => (current += ms) } as object),
  }
}

interface PhraseOverrides {
  difficulty?: Difficulty
  tags?: readonly Tag[]
  loved?: boolean
  learned?: boolean
  plays?: number
  reps?: number
  repsToday?: number
  repsTodayDay?: string | null
  automaticity?: number
  lockInDays?: number
  rung?: LadderRung
  stumbles?: number
  // The prosody block. All four move together; overriding `cueLevel` but not the axes
  // made the out-of-range values a clamping test needs unreachable from here.
  cueLevel?: number
  axPerception?: number
  axRecall?: number
  axProduction?: number
  addedAt?: number
  lastPracticedAt?: number | null
  graduatedAt?: number | null
}

export function makePhrase(id: string, o: PhraseOverrides = {}): PhraseState {
  return {
    id: userPhraseId(id),
    phraseId: catalogPhraseId(id),
    source: 'starter',
    difficulty: o.difficulty ?? 'med',
    tags: o.tags ?? [],
    loved: o.loved ?? false,
    learned: o.learned ?? false,
    note: null,
    plays: o.plays ?? 0,
    reps: o.reps ?? 0,
    addedAt: o.addedAt ?? T0 - 86_400_000,
    lastPracticedAt: o.lastPracticedAt ?? null,
    graduatedAt: o.graduatedAt ?? null,
    srs: null,
    repsToday: o.repsToday ?? 0,
    repsTodayDay: o.repsTodayDay ?? null,
    automaticity: o.automaticity ?? 0,
    lockInDays: o.lockInDays ?? 0,
    rung: o.rung ?? LadderRung.Accumulated,
    stumbles: o.stumbles ?? 0,
    cueLevel: o.cueLevel ?? 0,
    axPerception: o.axPerception ?? 0,
    axRecall: o.axRecall ?? 0,
    axProduction: o.axProduction ?? 0,
  }
}

/**
 * The blueprint's own seed data — Loro.dc.html:2873-2884.
 *
 * Ten phrases with real difficulties, tags, and rep counts. It's the default fixture
 * because it exercises every difficulty and tag combination that matters.
 */
export const seedFixture = (): PhraseState[] => [
  makePhrase('cafe1', { difficulty: 'easy', reps: 3, loved: true }),
  makePhrase('trv1', { difficulty: 'hard', tags: ['pron'], reps: 1 }),
  makePhrase('tlk1', { difficulty: 'med', tags: ['remember'], reps: 0 }),
  makePhrase('srv1', { difficulty: 'hard', tags: ['pron', 'useful'], reps: 2 }),
  makePhrase('cafe4', { difficulty: 'easy', tags: ['useful'], reps: 4 }),
  makePhrase('din1', { difficulty: 'med', reps: 1 }),
  makePhrase('shp1', { difficulty: 'easy', reps: 5, learned: true }),
  makePhrase('srv2', { difficulty: 'med', reps: 0 }),
  makePhrase('dir4', { difficulty: 'med', tags: ['remember'], reps: 1 }),
  makePhrase('htl2', { difficulty: 'med', tags: ['remember'], reps: 2 }),
]

/** 2 000 phrases — the design target for performance and scale tests. */
export const largeFixture = (n = 2000): PhraseState[] => {
  const cycle = ['easy', 'med', 'hard'] as const
  return Array.from({ length: n }, (_, i) =>
    makePhrase(`p${String(i).padStart(4, '0')}`, {
      difficulty: cycle[i % 3] ?? 'med',
      reps: i % 7,
      plays: i % 11,
      loved: i % 13 === 0,
      learned: i % 17 === 0,
    }),
  )
}

export function fakeRepository(phrases: readonly PhraseState[]): PhraseRepository {
  const snapshot = phrases.map((p) => ({ ...p }))
  return {
    all: () => Promise.resolve(snapshot),
    byId: (id) => Promise.resolve(snapshot.find((p) => p.id === id) ?? null),
    active: () => Promise.resolve(snapshot.filter(isActive)),
    due: (at) => Promise.resolve(snapshot.filter((p) => isDue(p, at))),
  }
}

/**
 * A stand-in for loro-core in `@loro/core` tests.
 *
 * Refrain numbers come from documented fixtures (`refrainFixtures.ts`), not a second
 * copy of the Rust formulae. Unknown inputs throw. `streamRank` and `repeatTarget` still
 * mirror the blueprint ranks the stream tests assert on. `fsrsReview` is a labelled test
 * double — not canonical FSRS.
 */
export function fakeCore(): LoroCoreFacade {
  return {
    rerate: (phrase) => phrase.srs,
    orderStream: (phrases, now) =>
      [...phrases]
        .sort(
          (a, b) =>
            fakeCore().streamRank(a, now) - fakeCore().streamRank(b, now) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )
        .map((phrase) => phrase.id),
    reviewGrade: (attempt) =>
      attempt.selfGrade !== undefined
        ? ({ again: 1, hard: 2, good: 3, easy: 4 } as const)[attempt.selfGrade]
        : attempt.confidence !== undefined
          ? ({ forgot: 1, shaky: 2, ok: 3, strong: 4, instant: 4 } as const)[attempt.confidence]
          : attempt.outcome !== 'success'
            ? 1
            : attempt.hintsUsed > 0
              ? 2
              : 3,
    repeatTarget: (d) => (d === 'hard' ? 4 : d === 'easy' ? 2 : 3),

    streamRank: (p, now) => {
      let r = p.plays
      r += p.difficulty === 'hard' ? -6 : p.difficulty === 'easy' ? 4 : 0
      if (p.loved) r -= 3
      if (p.srs !== null && p.srs.due <= now) r -= 4
      return r
    },

    selectRefrainSet: fakeSelectRefrainSet,
    automaticity: fixtureAutomaticity,
    refrainSetSize: fixtureRefrainSetSize,
    modeForRep: fixtureModeForRep,
    modelRateForMode: fixtureModelRateForMode,
    beatMsForMode: fixtureBeatMsForMode,

    // Deterministic stand-in: blank the second token.
    clozeMask: () => [1],

    // Labelled test double — not the canonical FSRS policy in core-rs.
    fsrsReview: (_state, grade, at) => {
      const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
      return {
        stability: days,
        difficulty: 5,
        due: at + days * 86_400_000,
        lastReview: at,
        lapses: grade === 1 ? 1 : 0,
        state: 'review',
        algorithm: 'test-fsrs',
      }
    },

    matchTokens: (heard, target, revealed) => {
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9ñ]/g, '')
      const h = heard.map(norm).filter(Boolean)
      const t = target.map(norm)
      let cursor = 0
      let matched = revealed
      for (let k = revealed; k < t.length; k++) {
        const idx = h.indexOf(t[k]!, cursor)
        if (idx < 0) break
        cursor = idx + 1
        matched = k + 1
      }
      const next = Math.max(matched, revealed)
      return {
        revealed: next,
        justIndex: next > revealed ? next - 1 : -1,
        complete: next >= t.length && t.length > 0,
      }
    },
  }
}

export const defaultSettings = (o: Partial<PracticeSettings> = {}): PracticeSettings => ({
  dailyMinutes: o.dailyMinutes ?? 10,
  waveTimes: o.waveTimes ?? ['08:00', '13:00', '19:00'],
  repTarget: o.repTarget ?? 6,
})

export function makeContext(
  phrases: readonly PhraseState[] = seedFixture(),
  overrides: Partial<EngineContext> = {},
): EngineContext {
  return {
    phrases: fakeRepository(phrases),
    clock: fakeClock(),
    core: fakeCore(),
    settings: defaultSettings(),
    trip: null,
    flags: { bool: (_k, d) => d, number: (_k, d) => d },
    seed: 42,
    ...overrides,
  }
}
