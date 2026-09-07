/**
 * The store's contract: what it can be asked to do, and what it needs to do it.
 *
 * Declared away from the implementation because it is the frozen part. Eight route files
 * and `ToastHost` are written against `AppState`; the slices under `slices/` are an
 * implementation detail that may be regrouped without touching a screen.
 */

import type { StoreApi } from 'zustand'
import type {
  LoroCoreFacade,
  NativeLanguage,
  TargetLocale,
  Clock,
  Difficulty,
  PhraseState,
  ProgressDelta,
  Tag,
  UserPhraseId,
} from '@loro/core'
import type { AppData, RefrainResume } from './state'
import type { OwnPhraseDraft } from './phraseFactory'

export interface AppActions {
  setLanguages: (nativeLanguage: NativeLanguage, targetLocale: TargetLocale) => void
  /**
   * Commit the first-run answers and seed the stream.
   *
   * Every field the four questions collect is REQUIRED, including `level`, which nothing reads
   * yet (plan 60 biases selection with it). That is deliberate: the previous signature took three
   * of the four and the fourth was dropped silently at the call site, so adding a fifth question
   * without wiring it now fails to compile rather than fails to persist.
   */
  completeOnboarding: (o: {
    goal: string
    level: string
    dailyMinutes: 5 | 10 | 20
    packIds: string[]
  }) => void
  addPhrase: (
    catalogId: string,
    o?: { difficulty?: Difficulty; tags?: Tag[]; source?: PhraseState['source'] },
  ) => void
  /** Returns the new row id, because the caller has no other way to name the row. */
  addOwnPhrase: (draft: OwnPhraseDraft, o?: { difficulty?: Difficulty; tags?: Tag[] }) => string
  removePhrase: (id: string) => void
  setDifficulty: (id: string, d: Difficulty) => void
  toggleTag: (id: string, t: Tag) => void
  toggleLoved: (id: string) => void
  markLearned: (id: string, learned: boolean) => void
  setNote: (id: string, note: string) => void
  recordPlay: (id: string) => void
  /**
   * The ONLY write path for a practice outcome. A screen calls `engine.record(...)` and
   * hands the result here; nothing else writes a progress field.
   */
  applyDelta: (delta: ProgressDelta, context?: PracticeCommitContext) => void
  select: (id: string | null) => void
  showToast: (message: string, undo?: () => void) => void
  clearToast: () => void
  /**
   * Make sure `refrainSet` is today's. Safe to call on every foreground and every entry
   * to a practice screen: it re-rolls only when the day changed, and otherwise backfills
   * a set that lost a member.
   */
  ensureRefrainSet: () => void
  reset: () => void
}

export type AppState = AppData & AppActions

/**
 * What the store needs from the platform.
 *
 * Injected so a test can drive a day rollover, and so the store's day logic is provable
 * rather than dependent on when the suite happens to run.
 */
export interface PracticeCommitContext {
  expectedPhrase?: PhraseState
  phraseId?: UserPhraseId
  review?: { grade: 1 | 2 | 3 | 4; at: number; algorithm: string }
  attemptId: string
  targetLocale: TargetLocale
  localDay: string
  streakDay: string
  sessionId?: string
  expectedCursor?: number
  checkpoint?: RefrainResume
}

/** Synchronous local transaction; returned data is a fresh repository projection. */
export interface StorePersistence {
  hasCatalog?(id: string, target: TargetLocale): boolean
  hasAttempt?(context: PracticeCommitContext): boolean
  load(): AppData | null
  commit(before: AppData, after: AppData, attempt?: PracticeCommitContext): AppData
  reset(): AppData
}

export interface StoreDeps {
  core?: Pick<LoroCoreFacade, 'refrainSetSize' | 'selectRefrainSet' | 'rerate'>
  persistence?: StorePersistence
  clock: Clock
  newId: () => UserPhraseId
}

/**
 * What a slice is handed.
 *
 * `get` rather than a direct import of a sibling slice: an action that calls another action
 * (`removePhrase` → `ensureRefrainSet`, `addPhrase` → `showToast`) must go through the store
 * so it sees the CURRENT function, and so the slices stay independent of each other's
 * grouping. The store stages these writes until the enclosing action commits locally.
 */
export interface SliceContext {
  readonly set: StoreApi<AppState>['setState']
  readonly get: StoreApi<AppState>['getState']
  readonly deps: StoreDeps
}

/**
 * A slice: the actions of one concern.
 *
 * Typed as a `Pick` of `AppActions` so the store's composition is checked both ways — a
 * slice cannot invent an action, and `createAppStore` will not compile until every action
 * in the contract is supplied by exactly one slice.
 */
export type Slice<K extends keyof AppActions> = (ctx: SliceContext) => Pick<AppActions, K>
