/**
 * The store's contract: what it can be asked to do, and what it needs to do it.
 *
 * Declared away from the implementation because it is the frozen part. Eight route files
 * and `ToastHost` are written against `AppState`; the slices under `slices/` are an
 * implementation detail that may be regrouped without touching a screen.
 */

import type { StoreApi } from 'zustand'
import type {
  NativeLanguage,
  TargetLocale,
  Clock,
  Difficulty,
  PhraseHandoffSource,
  PhraseState,
  ProgressDelta,
  RefrainDayRow,
  ReviewCheckpoint,
  SessionPlan,
  Tag,
  UserPhraseId,
} from '@loro/core'
import type { AppData, RefrainResume } from './state'
import type { OwnPhraseDraft } from './phraseFactory'
import type { ImportDraft } from '../lib/importDraft'
import type { LearnerStorage } from '../data/learner'
import type { AccentName } from '../ui/theme'
import type { DevicePreferences } from '../lib/devicePreferences'

export interface AppActions {
  saveImportDraft: (draft: ImportDraft) => void
  clearImportDraft: () => void
  setAnalyticsConsent: (consent: boolean) => void
  setVisualPreferences: (accent: AccentName, motion: DevicePreferences['motion']) => void
  setLanguages: (nativeLanguage: NativeLanguage, targetLocale: TargetLocale) => void
  /**
   * First-run UI language guess from the device locale. Must not mark the pair
   * chosen — that is `setLanguages` after the learner confirms.
   */
  previewNativeLanguage: (nativeLanguage: NativeLanguage) => void
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
  addOwnPhrase: (
    draft: OwnPhraseDraft,
    o?: { difficulty?: Difficulty; tags?: Tag[]; source?: PhraseHandoffSource },
  ) => string
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
  /** Stream browse position. The route rates/navigates; it does not write this field itself. */
  setStreamCursor: (streamCursor: number) => void
  /**
   * Device-local simple-queue listen order. Not a practice outcome and not Rust rank.
   * Empty or malformed lists fail closed to `null` (Rust rank).
   */
  setListenQueue: (phraseIds: readonly string[]) => void
  select: (id: string | null) => void
  showToast: (message: string, undo?: () => void) => void
  clearToast: () => void
  /**
   * Make sure `refrainSet` is today's. Safe to call on every foreground and every entry
   * to a practice screen: it re-rolls only when the day changed, and otherwise backfills
   * a set that lost a member.
   */
  ensureRefrainSet: () => void
  /** Record one completed, named wave with the day's durable Refrain state. */
  completeRefrainWave: (wave: 'morning' | 'midday' | 'evening', checkpoint: RefrainResume) => void
  /**
   * Open a planned Refrain session. The route still calls `refrainEngine.plan`; this
   * writes the same resume identity the screens, spine and Today already share.
   */
  beginRefrainSession: (plan: SessionPlan, wave: 'morning' | 'midday' | 'evening') => void
  /** Mid-session resume write — cursor advance without completing the wave. */
  saveRefrainCheckpoint: (checkpoint: RefrainResume) => void
  /**
   * Deliberately finish an in-progress Refrain session. This clears only its resumable
   * checkpoint; practice already earned through `applyDelta` remains intact.
   */
  endRefrainSession: () => void
  reset: () => void
}

export type AppState = AppData & AppActions

/** Capture before asynchronous engine work; the commit rejects stale or repeated outcomes. */
export interface PracticeCommitContext {
  readonly attemptId?: string
  readonly targetLocale?: TargetLocale
  readonly localDay?: string
  readonly streakDay?: string
  readonly expectedPhrase?: PhraseState
  readonly sessionId?: string
  readonly expectedCursor?: number
  readonly refrainCursor?: number
  readonly checkpoint?: RefrainResume
  readonly phraseId?: UserPhraseId
  readonly review?: {
    readonly at: number
    readonly grade: 1 | 2 | 3 | 4
    readonly algorithm: string
  }
  /**
   * Review resume payload written in the same transaction as `committed_attempt`
   * and `review_event`. `null` clears a finished session. Omit the key on
   * Stream/Refrain/Speak commits so those writes do not touch Review resume.
   */
  readonly reviewCheckpoint?: ReviewCheckpoint | null
}

/**
 * What the store needs from the platform.
 *
 * Injected so a test can drive a day rollover, and so the store's day logic is provable
 * rather than dependent on when the suite happens to run.
 */
export interface StoreDeps {
  clock: Clock
  newId: () => UserPhraseId
  storage?: LearnerStorage
  onPersistenceError?: (error: unknown) => void
}

/**
 * What a slice is handed.
 *
 * `get` rather than a direct import of a sibling slice: an action that calls another action
 * (`removePhrase` → `ensureRefrainSet`, `addPhrase` → `showToast`) must go through the store
 * so it sees the CURRENT function, and so the slices stay independent of each other's
 * grouping. Zustand's own `set`/`get`, unwrapped — no middleware.
 */
export interface SliceContext {
  readonly set: StoreApi<AppState>['setState']
  readonly get: StoreApi<AppState>['getState']
  readonly deps: StoreDeps
  readonly loadRefrainDay: (day: string, target: TargetLocale) => RefrainDayRow | null
  readonly hasCatalog: (id: string, target: TargetLocale) => boolean
}

/**
 * A slice: the actions of one concern.
 *
 * Typed as a `Pick` of `AppActions` so the store's composition is checked both ways — a
 * slice cannot invent an action, and `createAppStore` will not compile until every action
 * in the contract is supplied by exactly one slice.
 */
export type Slice<K extends keyof AppActions> = (ctx: SliceContext) => Pick<AppActions, K>
