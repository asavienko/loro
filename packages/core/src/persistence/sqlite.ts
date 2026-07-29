/**
 * The SQL implementations.
 *
 * Raw SQL rather than an ORM, deliberately: the schema is authored in
 * docs/architecture/data-model.md and this file must be readable against it column by
 * column. It also keeps the layer driver-agnostic — the same statements run under
 * `op-sqlite` on device and `node:sqlite` in tests, which is what makes any of this
 * verifiable before the native toolchain exists.
 */

import type {
  Difficulty,
  FsrsState,
  PhraseSource,
  PhraseState,
  Tag,
  Theme,
} from '../domain/phrase.js'
import { catalogPhraseId, userPhraseId, type UserPhraseId } from '../domain/ids.js'
import {
  boolToSql,
  readBool,
  readInt,
  readIntOrNull,
  readJson,
  readRealOrNull,
  readText,
  readTextOrNull,
  type SqlDriver,
  type SqlRow,
  type SqlValue,
} from './driver.js'
import { dropAll, migrate } from './migrations.js'
import {
  LOCAL_USER_ID,
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
  type FieldWrite,
} from './tables.js'
import { mergeClassFor, type SyncEntity } from '../sync/fieldPolicy.js'

// ─────────────────────────────────────────────────────────────────────────────
// user_phrase
// ─────────────────────────────────────────────────────────────────────────────

const PHRASE_COLUMNS = `
  id, user_id, phrase_id, own_es, own_en, own_theme, own_emoji, source,
  difficulty, tags, loved, learned, note,
  plays, reps, added_at, last_practiced_at, graduated_at,
  srs_stability, srs_difficulty, srs_due, srs_last_review, srs_lapses, srs_state,
  reps_today, reps_today_day, automaticity, lock_in_days,
  rung, stumbles,
  cue_level, ax_perception, ax_recall, ax_production,
  updated_hlc, field_hlc, deleted_at
`

function rowToPhrase(row: SqlRow): PhraseState {
  const stability = readRealOrNull(row, 'srs_stability')
  const due = readIntOrNull(row, 'srs_due')
  // FSRS state exists only when the algorithm actually ran. A row with a due date but no
  // stability is not a schedule, and must not be presented as one.
  const srs: FsrsState | null =
    stability === null || due === null
      ? null
      : {
          stability,
          difficulty: readRealOrNull(row, 'srs_difficulty') ?? 5,
          due,
          lastReview: readIntOrNull(row, 'srs_last_review'),
          lapses: readInt(row, 'srs_lapses'),
          state: readText(row, 'srs_state') as FsrsState['state'],
        }

  const ownEs = readTextOrNull(row, 'own_es')
  const ownEn = readTextOrNull(row, 'own_en')
  const ownTheme = readTextOrNull(row, 'own_theme')
  const ownEmoji = readTextOrNull(row, 'own_emoji')
  const phraseIdRaw = readTextOrNull(row, 'phrase_id')

  return {
    id: userPhraseId(readText(row, 'id')),
    phraseId: phraseIdRaw === null ? null : catalogPhraseId(phraseIdRaw),
    // `exactOptionalPropertyTypes` means an absent own_* field must be absent, not
    // undefined-valued, so these are spread conditionally.
    ...(ownEs === null ? {} : { ownEs }),
    ...(ownEn === null ? {} : { ownEn }),
    ...(ownTheme === null ? {} : { ownTheme: ownTheme as Theme }),
    ...(ownEmoji === null ? {} : { ownEmoji }),
    source: readText(row, 'source') as PhraseSource,

    difficulty: readText(row, 'difficulty') as Difficulty,
    tags: readJson<Tag[]>(row, 'tags', []),
    loved: readBool(row, 'loved'),
    learned: readBool(row, 'learned'),
    note: readTextOrNull(row, 'note'),

    plays: readInt(row, 'plays'),
    reps: readInt(row, 'reps'),
    addedAt: readInt(row, 'added_at'),
    lastPracticedAt: readIntOrNull(row, 'last_practiced_at'),
    graduatedAt: readIntOrNull(row, 'graduated_at'),

    srs,

    repsToday: readInt(row, 'reps_today'),
    repsTodayDay: readTextOrNull(row, 'reps_today_day'),
    automaticity: readInt(row, 'automaticity'),
    lockInDays: readInt(row, 'lock_in_days'),

    rung: readInt(row, 'rung'),
    stumbles: readInt(row, 'stumbles'),

    cueLevel: readInt(row, 'cue_level'),
    axPerception: readInt(row, 'ax_perception'),
    axRecall: readInt(row, 'ax_recall'),
    axProduction: readInt(row, 'ax_production'),
  }
}

function phraseToParams(p: PhraseState, userId: string, hlc: string): SqlValue[] {
  return [
    p.id,
    userId,
    p.phraseId,
    p.ownEs ?? null,
    p.ownEn ?? null,
    p.ownTheme ?? null,
    p.ownEmoji ?? null,
    p.source,

    p.difficulty,
    JSON.stringify(p.tags),
    boolToSql(p.loved),
    boolToSql(p.learned),
    p.note,

    p.plays,
    p.reps,
    p.addedAt,
    p.lastPracticedAt,
    p.graduatedAt,

    p.srs?.stability ?? null,
    p.srs?.difficulty ?? null,
    p.srs?.due ?? null,
    p.srs?.lastReview ?? null,
    p.srs?.lapses ?? 0,
    p.srs?.state ?? 'new',

    p.repsToday,
    p.repsTodayDay,
    p.automaticity,
    p.lockInDays,

    p.rung,
    p.stumbles,

    p.cueLevel,
    p.axPerception,
    p.axRecall,
    p.axProduction,

    hlc,
    '{}',
    null,
  ]
}

const PHRASE_PLACEHOLDERS = Array.from({ length: 37 }, () => '?').join(', ')

export class SqlPhraseTable implements PhraseTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly hlc: () => string,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  all(): PhraseState[] {
    return this.driver
      .all(
        `SELECT ${PHRASE_COLUMNS} FROM user_phrase
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY id`,
        [this.userId],
      )
      .map(rowToPhrase)
  }

  byId(id: UserPhraseId): PhraseState | null {
    const rows = this.driver.all(
      `SELECT ${PHRASE_COLUMNS} FROM user_phrase
       WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
      [this.userId, id],
    )
    const row = rows[0]
    return row === undefined ? null : rowToPhrase(row)
  }

  active(): PhraseState[] {
    return this.driver
      .all(
        `SELECT ${PHRASE_COLUMNS} FROM user_phrase
         WHERE user_id = ? AND deleted_at IS NULL AND learned = 0 AND graduated_at IS NULL
         ORDER BY id`,
        [this.userId],
      )
      .map(rowToPhrase)
  }

  due(at: number): PhraseState[] {
    return this.driver
      .all(
        `SELECT ${PHRASE_COLUMNS} FROM user_phrase
         WHERE user_id = ? AND deleted_at IS NULL AND learned = 0
           AND srs_due IS NOT NULL AND srs_due <= ?
         ORDER BY srs_due`,
        [this.userId, at],
      )
      .map(rowToPhrase)
  }

  upsert(phrase: PhraseState): void {
    this.driver.run(
      `INSERT OR REPLACE INTO user_phrase (${PHRASE_COLUMNS}) VALUES (${PHRASE_PLACEHOLDERS})`,
      phraseToParams(phrase, this.userId, this.hlc()),
    )
  }

  softDelete(id: UserPhraseId, at: number): void {
    this.driver.run(
      `UPDATE user_phrase SET deleted_at = ?, updated_hlc = ? WHERE user_id = ? AND id = ?`,
      [at, this.hlc(), this.userId, id],
    )
  }

  count(): number {
    const rows = this.driver.all(
      'SELECT COUNT(*) AS n FROM user_phrase WHERE user_id = ? AND deleted_at IS NULL',
      [this.userId],
    )
    const row = rows[0]
    return row === undefined ? 0 : readInt(row, 'n')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// settings
// ─────────────────────────────────────────────────────────────────────────────

export class SqlSettingsTable implements SettingsTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly hlc: () => string,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  load(): SettingsRow | null {
    const rows = this.driver.all(
      `SELECT onboarded, goal, level, daily_minutes, wave_times FROM settings WHERE user_id = ?`,
      [this.userId],
    )
    const row = rows[0]
    if (row === undefined) return null
    const minutes = readIntOrNull(row, 'daily_minutes')
    return {
      onboarded: readBool(row, 'onboarded'),
      goal: readTextOrNull(row, 'goal'),
      level: readTextOrNull(row, 'level'),
      dailyMinutes: minutes === 5 || minutes === 10 || minutes === 20 ? minutes : null,
      waveTimes: readJson<string[]>(row, 'wave_times', []),
    }
  }

  save(settings: SettingsRow): void {
    this.driver.run(
      `INSERT OR REPLACE INTO settings
         (user_id, onboarded, goal, level, daily_minutes, wave_times, updated_hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        this.userId,
        boolToSql(settings.onboarded),
        settings.goal,
        settings.level,
        settings.dailyMinutes,
        JSON.stringify(settings.waveTimes),
        this.hlc(),
      ],
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// refrain_day
// ─────────────────────────────────────────────────────────────────────────────

function rowToRefrainDay(row: SqlRow): RefrainDayRow {
  return {
    localDay: readText(row, 'local_day'),
    setIds: readJson<string[]>(row, 'set_ids', []),
    substituted: readJson<string[]>(row, 'substituted', []),
  }
}

export class SqlRefrainDayTable implements RefrainDayTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  load(localDay: string): RefrainDayRow | null {
    const rows = this.driver.all(
      `SELECT local_day, set_ids, substituted FROM refrain_day WHERE user_id = ? AND local_day = ?`,
      [this.userId, localDay],
    )
    const row = rows[0]
    return row === undefined ? null : rowToRefrainDay(row)
  }

  latest(): RefrainDayRow | null {
    const rows = this.driver.all(
      `SELECT local_day, set_ids, substituted FROM refrain_day
       WHERE user_id = ? ORDER BY local_day DESC LIMIT 1`,
      [this.userId],
    )
    const row = rows[0]
    return row === undefined ? null : rowToRefrainDay(row)
  }

  save(row: RefrainDayRow): void {
    this.driver.run(
      `INSERT OR REPLACE INTO refrain_day (user_id, local_day, set_ids, waves, substituted)
       VALUES (?, ?, ?, '[]', ?)`,
      [this.userId, row.localDay, JSON.stringify(row.setIds), JSON.stringify(row.substituted)],
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// streak_day
// ─────────────────────────────────────────────────────────────────────────────

export class SqlPracticeDayTable implements PracticeDayTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  all(): string[] {
    return this.driver
      .all(
        `SELECT local_day FROM streak_day WHERE user_id = ? AND practised = 1 ORDER BY local_day`,
        [this.userId],
      )
      .map((row) => readText(row, 'local_day'))
  }

  add(localDay: string, minutes = 0): void {
    // Practising twice on one day is one day. `minutes` accumulates because it is a
    // duration, not a flag.
    this.driver.run(
      `INSERT INTO streak_day (user_id, local_day, practised, minutes) VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, local_day)
       DO UPDATE SET practised = 1, minutes = minutes + excluded.minutes`,
      [this.userId, localDay, minutes],
    )
  }

  pruneBefore(localDay: string): void {
    this.driver.run(`DELETE FROM streak_day WHERE user_id = ? AND local_day < ?`, [
      this.userId,
      localDay,
    ])
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// outbox
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether a field may be folded into an already-queued op for the same row.
 *
 * Only `lww` may: the later value is the answer, so replacing the earlier one loses
 * nothing. `max` could be folded by taking the maximum, and compaction does exactly that,
 * but a plain replace would let a lower count overwrite a higher one — which is the very
 * bug the `max` class exists to prevent. `append-only` rows are a log; folding two
 * entries deletes one. `latest-review` must move as a group. `tombstone` must not be
 * merged with the edits it supersedes.
 */
function coalescable(entity: string, field: string): boolean {
  if (!isSyncEntity(entity)) return false
  return mergeClassFor(entity, field) === 'lww'
}

function isSyncEntity(entity: string): entity is SyncEntity {
  return (
    entity === 'user_phrase' ||
    entity === 'trip' ||
    entity === 'trip_drop' ||
    entity === 'trip_phrase' ||
    entity === 'settings' ||
    entity === 'refrain_day' ||
    entity === 'streak_day' ||
    entity === 'review_log' ||
    entity === 'latency_sample' ||
    entity === 'take' ||
    entity === 'session' ||
    entity === 'attempt'
  )
}

/** `max` fields fold by taking the larger value, which is lossless. */
function maxFolding(entity: string, field: string): boolean {
  return isSyncEntity(entity) && mergeClassFor(entity, field) === 'max'
}

function rowToOp(row: SqlRow): OutboxOp {
  return {
    seq: readInt(row, 'seq'),
    entity: readText(row, 'entity'),
    entityId: readText(row, 'entity_id'),
    op: readText(row, 'op') as OutboxOp['op'],
    fields: readJson<Record<string, FieldWrite>>(row, 'payload', {}),
    hlc: readText(row, 'hlc'),
    createdAt: readInt(row, 'created_at'),
    attempts: readInt(row, 'attempts'),
  }
}

export class SqlOutboxTable implements OutboxTable {
  constructor(private readonly driver: SqlDriver) {}

  append(op: OutboxAppend): void {
    const fields = Object.keys(op.fields)
    const foldable =
      op.op === 'upsert' && fields.length > 0 && fields.every((f) => coalescable(op.entity, f))

    if (foldable) {
      const pending = this.newestPendingUpsert(op.entity, op.entityId)
      if (pending !== null) {
        // Replace the earlier values in place rather than queueing a second op: two `lww`
        // writes to the same field are one write as far as the server is concerned, and a
        // learner who taps a rating four times should not cost four round trips.
        this.driver.run('UPDATE outbox SET payload = ?, hlc = ? WHERE seq = ?', [
          JSON.stringify({ ...pending.fields, ...op.fields }),
          op.hlc,
          pending.seq,
        ])
        return
      }
    }

    this.driver.run(
      `INSERT INTO outbox (entity, entity_id, op, payload, hlc, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [op.entity, op.entityId, op.op, JSON.stringify(op.fields), op.hlc, op.createdAt],
    )
  }

  private newestPendingUpsert(entity: string, entityId: string): OutboxOp | null {
    const rows = this.driver.all(
      `SELECT seq, entity, entity_id, op, payload, hlc, created_at, attempts FROM outbox
       WHERE entity = ? AND entity_id = ? AND op = 'upsert'
       ORDER BY seq DESC LIMIT 1`,
      [entity, entityId],
    )
    const row = rows[0]
    return row === undefined ? null : rowToOp(row)
  }

  pending(limit: number): OutboxOp[] {
    return this.driver
      .all(
        `SELECT seq, entity, entity_id, op, payload, hlc, created_at, attempts FROM outbox
         ORDER BY seq LIMIT ?`,
        [limit],
      )
      .map(rowToOp)
  }

  ack(seqs: readonly number[]): void {
    if (seqs.length === 0) return
    this.driver.run(`DELETE FROM outbox WHERE seq IN (${seqs.map(() => '?').join(', ')})`, seqs)
  }

  recordFailure(seqs: readonly number[], error: string): void {
    if (seqs.length === 0) return
    this.driver.run(
      `UPDATE outbox SET attempts = attempts + 1, last_error = ?
       WHERE seq IN (${seqs.map(() => '?').join(', ')})`,
      [error, ...seqs] as SqlValue[],
    )
  }

  size(): number {
    const rows = this.driver.all('SELECT COUNT(*) AS n FROM outbox')
    const row = rows[0]
    return row === undefined ? 0 : readInt(row, 'n')
  }

  compact(maxOps: number): number {
    if (this.size() <= maxOps) return 0

    let removed = 0
    this.driver.transaction(() => {
      const groups = new Map<string, OutboxOp[]>()
      for (const op of this.pending(Number.MAX_SAFE_INTEGER)) {
        if (op.op !== 'upsert') continue
        const key = `${op.entity} ${op.entityId}`
        const list = groups.get(key) ?? []
        list.push(op)
        groups.set(key, list)
      }

      for (const ops of groups.values()) {
        if (ops.length < 2) continue
        // Fold forward into the OLDEST op so queue order is preserved: the server sees
        // this row's change where it originally sat in the sequence.
        const target = ops[0]
        if (target === undefined) continue

        const merged: Record<string, FieldWrite> = { ...target.fields }
        const dropped: number[] = []
        let mergedAny = false

        for (const later of ops.slice(1)) {
          let foldable = true
          for (const [field, write] of Object.entries(later.fields)) {
            if (coalescable(later.entity, field)) continue
            if (maxFolding(later.entity, field) && typeof write.v === 'number') continue
            foldable = false
            break
          }
          if (!foldable) break // stop at the first op that cannot be folded, keeping order

          for (const [field, write] of Object.entries(later.fields)) {
            const existing = merged[field]
            if (
              maxFolding(later.entity, field) &&
              existing !== undefined &&
              typeof existing.v === 'number' &&
              typeof write.v === 'number'
            ) {
              // Lossless: a monotonic counter's answer is its maximum.
              merged[field] = write.v >= existing.v ? write : existing
            } else {
              merged[field] = write
            }
          }
          dropped.push(later.seq)
          mergedAny = true
        }

        if (!mergedAny) continue
        this.driver.run('UPDATE outbox SET payload = ? WHERE seq = ?', [
          JSON.stringify(merged),
          target.seq,
        ])
        this.ack(dropped)
        removed += dropped.length
      }
    })
    return removed
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open a persistence set over a driver, applying migrations first.
 *
 * @param hlc from `core-rs` — see `OutboxAppend.hlc`.
 * @param at epoch ms, for the migration record.
 */
export function openSqlPersistence(
  driver: SqlDriver,
  hlc: () => string,
  at: number,
  userId: string = LOCAL_USER_ID,
): Persistence {
  migrate(driver, at)
  return {
    phrases: new SqlPhraseTable(driver, hlc, userId),
    settings: new SqlSettingsTable(driver, hlc, userId),
    refrainDay: new SqlRefrainDayTable(driver, userId),
    practiceDays: new SqlPracticeDayTable(driver, userId),
    outbox: new SqlOutboxTable(driver),
    wipe: () => {
      // Drop and recreate rather than DELETE: a dropped table leaves no rows to recover
      // from the freelist, which is what erasure has to mean.
      dropAll(driver)
      migrate(driver, at)
    },
  }
}
