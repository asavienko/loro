import type { LanguagePair, TargetLocale } from '../domain/languages.js'
/**
 * What the app needs from storage, as interfaces.
 *
 * Two implementations satisfy every one of these: SQL (`sqlite/`, one module per table)
 * and in-memory (`memory.ts`). The in-memory set is not a test double — it is the web target's real
 * storage, because `expo start --web` has no SQLite and is currently the fastest way to
 * see the screens.
 *
 * Reads here are SYNCHRONOUS. The engine contract's `PhraseRepository` is async, and
 * `asPhraseRepository` adapts one to the other: engines keep their promise-shaped
 * contract, and the store does not await a local read to paint a frame.
 */

import type { UserPhraseId } from '../domain/ids.js'
import type { CourseCheckpoint } from './checkpoint.js'
import type { FsrsState, PhraseState } from '../domain/phrase.js'
import type { PhraseRepository } from '../engines/types.js'

/**
 * Until accounts exist (plans/14-auth-anonymous-first.md) every row belongs to one local
 * learner. Named rather than empty so the column is never ambiguous, and so the day auth
 * lands it is a migration rather than an archaeology exercise.
 */
export const LOCAL_USER_ID = 'local'

export interface PhraseTable {
  /** Includes tombstones so initial seeding never recreates a learner-deleted catalog entry. */
  hasCatalog(id: string, target: TargetLocale): boolean
  all(): PhraseState[]
  byId(id: UserPhraseId): PhraseState | null
  /** Not learned, not graduated, not deleted — what an engine may plan with. */
  active(): PhraseState[]
  due(at: number): PhraseState[]
  /**
   * Insert the row, or overwrite every field a `PhraseState` carries. The caller owns the
   * merge, not the database.
   *
   * It does NOT clear the tombstone or the per-field merge history: `PhraseState` has no
   * `deletedAt` and no HLC map, so an upsert holds no claim about either, and a write that
   * reset them let a stale value resurrect a deleted row. Both implementations preserve
   * them; see `sqlite/phrase.ts` for what that used to cost.
   */
  upsert(phrase: PhraseState): void
  /**
   * Soft delete, idempotently. A hard delete cannot be synced: the other device would see
   * the row missing and treat it as never having existed, so the removal would come
   * straight back (docs/architecture/sync-protocol.md).
   */
  softDelete(id: UserPhraseId, at: number): void
  /** Explicit local undo; ordinary writes never clear a tombstone. */
  restore(id: UserPhraseId): void
  count(): number
}

/** The learner's settings. One row. */
export interface SettingsRow {
  languagePair?: LanguagePair
  onboarded: boolean
  goal: string | null
  level: string | null
  dailyMinutes: 5 | 10 | 20 | null
  waveTimes: string[]
}

export interface SettingsTable {
  load(): SettingsRow | null
  save(settings: SettingsRow): void
}

/** Today's frozen Refrain set. */
export interface RefrainDayRow {
  targetLocale?: TargetLocale
  localDay: string
  setIds: string[]
  /**
   * The wave keys the learner has FINISHED today, in the order they finished.
   *
   * `refrain_day.waves` has existed since migration 1, but the repository bound a literal
   * `'[]'` into every write, so the column could not be read or written and a completed
   * wave died with the process. That is the durability half of `LB-03` ("three waves …
   * with done/ready/locked states"): `done` is a fact about the LEARNER and must survive a
   * relaunch, while `ready`/`locked` come from the clock and are derived
   * (`apps/mobile/src/lib/waves.ts`).
   *
   * Empty until plan 64 writes it — no screen may render a wave as done on the strength of
   * an empty array (non-negotiable 2).
   */
  waves: string[]
  substituted: string[]
}

export interface RefrainDayTable {
  load(localDay: string, targetLocale?: TargetLocale): RefrainDayRow | null
  /** The most recent day on record, whatever it is — what hydration reads. */
  latest(targetLocale?: TargetLocale): RefrainDayRow | null
  save(row: RefrainDayRow): void
}

/**
 * The streak history: the distinct streak days at least one rep landed on.
 *
 * A history, not a counter. The count is derived by `streak()` in `core-rs`, so the app
 * and the widget cannot disagree (ADR-0002).
 */
export interface PracticeDayTable {
  all(): string[]
  /** Idempotent: practising twice on one day is one day. */
  add(localDay: string, minutes?: number): void
  /** Drop everything before `localDay`, for the retention cap. */
  pruneBefore(localDay: string): void
}

/** Everything the app stores, in one bag, so callers take one dependency. */
export interface Persistence {
  transaction<T>(fn: () => T): T
  nextHlc(): string
  readonly metadata: MetadataTable
  readonly checkpoints: CheckpointTable
  readonly attempts: AttemptTable
  readonly reviews: ReviewTable
  readonly courses: CourseTable
  readonly phrases: PhraseTable
  readonly settings: SettingsTable
  readonly refrainDay: RefrainDayTable
  readonly practiceDays: PracticeDayTable
  readonly outbox: OutboxTable
  /** Erase this local owner, including tombstones and queued operations. Other owners remain. */
  wipe(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// The outbox
// ─────────────────────────────────────────────────────────────────────────────

export type SyncOpKind = 'upsert' | 'delete'

/** JSON field payloads remain structured on the wire and inside the outbox JSON envelope. */
export type JsonFieldValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonFieldValue[]
  | { readonly [key: string]: JsonFieldValue }

/** A field value with the HLC that produced it — the wire shape `/sync/push` accepts. */
export interface FieldWrite {
  readonly v: JsonFieldValue
  readonly hlc: string
}

export interface OutboxOp {
  readonly seq: number
  readonly entity: string
  readonly entityId: string
  readonly op: SyncOpKind
  readonly fields: Readonly<Record<string, FieldWrite>>
  readonly hlc: string
  readonly createdAt: number
  readonly attempts: number
}

/** What a caller appends. `seq` is the store's to assign. */
export interface OutboxAppend {
  readonly entity: string
  readonly entityId: string
  readonly op: SyncOpKind
  readonly fields: Readonly<Record<string, FieldWrite>>
  /**
   * From `core-rs`'s HLC (`packages/core-rs/src/sync/hlc.rs`) — never generated here.
   * A second implementation of a clock that orders sync operations is exactly the
   * divergence ADR-0002 exists to prevent.
   */
  readonly hlc: string
  readonly createdAt: number
}

export interface OutboxTable {
  append(op: OutboxAppend): void
  /** The oldest `limit` ops, in seq order. What the sync client drains. */
  pending(limit: number): OutboxOp[]
  /** Remove ops the server accepted. */
  ack(seqs: readonly number[]): void
  /** Record a failed flush without losing the op. */
  recordFailure(seqs: readonly number[], error: string): void
  size(): number
  /**
   * Merge queued ops per entity when the queue grows past `maxOps`.
   *
   * Compaction NEVER drops a learner's write: it merges ops that can be merged without
   * losing information (see `coalescable` / `maxFolding` in `sqlite/outbox.ts`, both
   * decided by the field's merge class) and leaves the rest alone. An
   * outbox that drops writes to stay small is a data-loss bug with a performance excuse.
   */
  compact(maxOps: number): number
}

// ─────────────────────────────────────────────────────────────────────────────

/** Adapt a synchronous table to the engine contract's async repository. */
export function asPhraseRepository(table: PhraseTable): PhraseRepository {
  return {
    all: () => Promise.resolve(table.all()),
    byId: (id) => Promise.resolve(table.byId(id)),
    active: () => Promise.resolve(table.active()),
    due: (at) => Promise.resolve(table.due(at)),
  }
}

/** Device-local session resume metadata; phrase progress remains in user_phrase. */
export interface CourseRow {
  targetLocale: TargetLocale
  onboarded: boolean
  selectedId: string | null
  streamCursor: number
  refrainSession: string | null
}
export interface CourseTable {
  all(): CourseRow[]
  load(target: TargetLocale): CourseRow | null
  save(row: CourseRow): void
}

export interface MetadataTable {
  get(key: string): string | null
  set(key: string, value: string): void
  delete(key: string): void
}
export interface CheckpointTable {
  load(target: TargetLocale): CourseCheckpoint | null
  save(checkpoint: CourseCheckpoint): void
  clear(target: TargetLocale): void
}
export interface AttemptTable {
  has(target: TargetLocale, attemptId: string): boolean
  /** Returns false for an already committed attempt. Call inside the same transaction as progress. */
  record(target: TargetLocale, attemptId: string): boolean
}
/** Scalar local review history: never audio or recognition transcripts. */
export interface ReviewEvent {
  attemptId: string
  targetLocale: TargetLocale
  phraseId: string
  reviewedAt: number
  rating: 1 | 2 | 3 | 4
  algorithm: string
  state: FsrsState
}
export interface ReviewTable {
  append(event: ReviewEvent): void
  all(target: TargetLocale): ReviewEvent[]
}
