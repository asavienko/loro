import { decodeCheckpoint, encodeCheckpoint } from './checkpoint.js'
import { synchronousResult } from './transaction.js'
import { validateReview } from './sqlite/local.js'
import type { ReviewEvent } from './tables.js'
import { parseLanguagePair } from '../domain/languages.js'
import type { CourseRow } from './tables.js'
import type { TargetLocale } from '../domain/languages.js'
/**
 * The in-memory persistence set.
 *
 * Not a test double: this is the **web target's real storage**. `expo start --web` has no
 * SQLite, and web is currently the fastest way to see the screens, so the screens have to
 * keep working against something. It is also what engine tests use, so they never need a
 * database.
 *
 * It forgets everything on reload, and that is the honest behaviour for a target with
 * nowhere to write. Nothing here pretends to persist.
 */

import type { UserPhraseId } from '../domain/ids.js'
import { isActive, isDue, type PhraseState } from '../domain/phrase.js'
import {
  type OutboxAppend,
  type OutboxOp,
  type OutboxTable,
  type Persistence,
  type PhraseTable,
  type PracticeDayTable,
  type RefrainDayRow,
  type RefrainDayTable,
  type SettingsRow,
  type SettingsTable,
} from './tables.js'

class MemoryPhraseTable implements PhraseTable {
  private rows = new Map<string, PhraseState>()
  private deleted = new Set<string>()

  hasCatalog(id: string, target: TargetLocale): boolean {
    return [...this.rows.values()].some(
      (p) => p.phraseId === id && (p.targetLocale ?? 'es-ES') === target,
    )
  }

  all(): PhraseState[] {
    return [...this.rows.values()]
      .filter((p) => !this.deleted.has(p.id))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  byId(id: UserPhraseId): PhraseState | null {
    if (this.deleted.has(id)) return null
    return this.rows.get(id) ?? null
  }

  // `isActive` / `isDue` rather than the predicates spelled out: the rule is the domain's
  // (`domain/phrase.ts`), and writing it here again is how the store's copy came to disagree.
  active(): PhraseState[] {
    return this.all().filter(isActive)
  }

  due(at: number): PhraseState[] {
    return this.all()
      .filter((p) => isDue(p, at))
      .sort((a, b) => (a.srs?.due ?? 0) - (b.srs?.due ?? 0))
  }

  /**
   * Write the row. The tombstone is NOT cleared — see `sqlite/phrase.ts`.
   *
   * This used to `deleted.delete(id)`, which is the in-memory spelling of the same
   * resurrection bug `INSERT OR REPLACE` caused in SQL: a stale write, or a plain re-add,
   * undid a deletion. Nothing about a `PhraseState` says "undelete" — the type has no
   * `deletedAt` field to carry the claim — so an upsert cannot be the operation that
   * decides one.
   */
  upsert(phrase: PhraseState): void {
    this.rows.set(phrase.id, phrase)
  }

  /** Idempotent, matching the SQL `deleted_at IS NULL` guard. */
  softDelete(id: UserPhraseId, _at: number): void {
    if (this.rows.has(id)) this.deleted.add(id)
  }

  restore(id: UserPhraseId): void {
    this.deleted.delete(id)
  }

  count(): number {
    return this.all().length
  }

  clear(): void {
    this.rows = new Map()
    this.deleted = new Set()
  }
}

class MemorySettingsTable implements SettingsTable {
  private row: SettingsRow | null = null
  load(): SettingsRow | null {
    return this.row
  }
  save(settings: SettingsRow): void {
    if (settings.languagePair) parseLanguagePair(settings.languagePair)
    this.row = { ...settings, waveTimes: [...settings.waveTimes] }
  }
  clear(): void {
    this.row = null
  }
}

class MemoryRefrainDayTable implements RefrainDayTable {
  private days = new Map<string, RefrainDayRow>()

  load(localDay: string, target: TargetLocale = 'es-ES'): RefrainDayRow | null {
    return this.days.get(`${target}/${localDay}`) ?? null
  }

  latest(target: TargetLocale = 'es-ES'): RefrainDayRow | null {
    const keys = [...this.days.keys()].filter((key) => key.startsWith(`${target}/`)).sort()
    const newest = keys[keys.length - 1]
    return newest === undefined ? null : (this.days.get(newest) ?? null)
  }

  save(row: RefrainDayRow): void {
    this.days.set(`${row.targetLocale ?? 'es-ES'}/${row.localDay}`, {
      ...(row.targetLocale && row.targetLocale !== 'es-ES'
        ? { targetLocale: row.targetLocale }
        : {}),
      localDay: row.localDay,
      setIds: [...row.setIds],
      waves: [...row.waves],
      substituted: [...row.substituted],
    })
  }

  clear(): void {
    this.days = new Map()
  }
}

class MemoryPracticeDayTable implements PracticeDayTable {
  private days = new Map<string, number>()

  all(): string[] {
    return [...this.days.keys()].sort()
  }

  add(localDay: string, minutes = 0): void {
    this.days.set(localDay, (this.days.get(localDay) ?? 0) + minutes)
  }

  pruneBefore(localDay: string): void {
    for (const day of [...this.days.keys()]) {
      if (day < localDay) this.days.delete(day)
    }
  }

  clear(): void {
    this.days = new Map()
  }
}

class MemoryOutboxTable implements OutboxTable {
  private ops: OutboxOp[] = []
  private nextSeq = 1

  append(op: OutboxAppend): void {
    // No coalescing here. The web target never flushes — there is no sync client for it —
    // so folding ops would only hide what a caller queued. The SQL implementation is
    // where coalescing is specified and tested.
    this.ops.push({ ...op, seq: this.nextSeq++, attempts: 0 })
  }

  pending(limit: number): OutboxOp[] {
    return this.ops.slice(0, limit)
  }

  ack(seqs: readonly number[]): void {
    const drop = new Set(seqs)
    this.ops = this.ops.filter((o) => !drop.has(o.seq))
  }

  recordFailure(seqs: readonly number[], error: string): void {
    const hit = new Set(seqs)
    this.ops = this.ops.map((o) =>
      hit.has(o.seq) ? { ...o, attempts: o.attempts + 1, lastError: error } : o,
    )
  }

  size(): number {
    return this.ops.length
  }

  compact(_maxOps: number): number {
    return 0
  }

  clear(): void {
    this.ops = []
    this.nextSeq = 1
  }
}

/** A fresh in-memory persistence set. */
export function openMemoryPersistence(hlc?: (previous: string | null) => string): Persistence {
  const courses = new Map<TargetLocale, CourseRow>()
  const phrases = new MemoryPhraseTable()
  const settings = new MemorySettingsTable()
  const refrainDay = new MemoryRefrainDayTable()
  const practiceDays = new MemoryPracticeDayTable()
  const outbox = new MemoryOutboxTable()

  const metadata = new Map<string, string>()
  const checkpoints = new Map<TargetLocale, string>()
  const attempts = new Set<string>()
  const reviews: ReviewEvent[] = []
  const tables = [phrases, settings, refrainDay, practiceDays, outbox]
  return {
    transaction: (fn) => {
      const snapshots = tables.map((table) =>
        structuredClone(Object.fromEntries(Object.entries(table))),
      )
      const local = structuredClone({ courses, metadata, checkpoints, attempts, reviews })
      try {
        return synchronousResult(fn())
      } catch (error) {
        tables.forEach((table, i) => Object.assign(table, snapshots[i]))
        courses.clear()
        local.courses.forEach((v, k) => courses.set(k, v))
        metadata.clear()
        local.metadata.forEach((v, k) => metadata.set(k, v))
        checkpoints.clear()
        local.checkpoints.forEach((v, k) => checkpoints.set(k, v))
        attempts.clear()
        local.attempts.forEach((v) => attempts.add(v))
        reviews.splice(0, reviews.length, ...local.reviews)
        throw error
      }
    },
    nextHlc: () => {
      if (!hlc)
        throw new Error(
          'Memory persistence has no canonical HLC; inject a canonical clock for writes',
        )
      const value = hlc(metadata.get('hlc') ?? null)
      metadata.set('hlc', value)
      return value
    },
    metadata: {
      get: (key) => metadata.get(key) ?? null,
      set: (key, value) => {
        metadata.set(key, value)
      },
      delete: (key) => {
        metadata.delete(key)
      },
    },
    checkpoints: {
      load: (target) => decodeCheckpoint(checkpoints.get(target) ?? ''),
      save: (value) => {
        checkpoints.set(value.targetLocale, encodeCheckpoint(value))
      },
      clear: (target) => {
        checkpoints.delete(target)
      },
    },
    attempts: {
      has: (target, id) => attempts.has(`${target}/${id}`),
      record: (target, id) => {
        if (!id || id.length > 512) throw new Error('Invalid attempt identity')
        const key = `${target}/${id}`
        if (attempts.has(key)) return false
        attempts.add(key)
        return true
      },
    },
    reviews: {
      append: (event) => {
        validateReview(event)
        if (
          reviews.some(
            (r) => r.targetLocale === event.targetLocale && r.attemptId === event.attemptId,
          )
        )
          throw new Error('Duplicate review event')
        reviews.push(structuredClone(event))
      },
      all: (target) => structuredClone(reviews.filter((r) => r.targetLocale === target)),
    },
    courses: {
      all: () => [...courses.values()].map((row) => ({ ...row })),
      load: (target) => courses.get(target) ?? null,
      save: (row) => {
        courses.set(row.targetLocale, { ...row })
      },
    },
    phrases,
    settings,
    refrainDay,
    practiceDays,
    outbox,
    wipe: () => {
      metadata.clear()
      checkpoints.clear()
      attempts.clear()
      reviews.length = 0
      courses.clear()
      phrases.clear()
      settings.clear()
      refrainDay.clear()
      practiceDays.clear()
      outbox.clear()
    },
  }
}
