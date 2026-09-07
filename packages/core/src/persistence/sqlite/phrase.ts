import { isNativeLanguage, isTargetLocale, type TargetLocale } from '../../domain/languages.js'
/**
 * `user_phrase` — the learner's rows.
 *
 * Raw SQL rather than an ORM, deliberately: the schema is authored in
 * docs/architecture/data-model.md and this file must be readable against it column by
 * column. That is also why `PHRASE_COLUMNS` keeps the document's grouping and line
 * breaks rather than collapsing to one line.
 */

import type {
  Difficulty,
  FsrsState,
  PhraseSource,
  PhraseState,
  Tag,
  Theme,
} from '../../domain/phrase.js'
import { catalogPhraseId, userPhraseId, type UserPhraseId } from '../../domain/ids.js'
import {
  boolToSql,
  firstRow,
  placeholders,
  readBool,
  readInt,
  readIntOrNull,
  readJson,
  readRealOrNull,
  readText,
  readTextOrNull,
  type SqlRow,
  type SqlValue,
} from '../driver.js'
import type { PhraseTable } from '../tables.js'
import type { SyncedTableDeps } from './deps.js'

/**
 * The column list, grouped as docs/architecture/data-model.md groups it so the two can be
 * read side by side.
 *
 * An ARRAY rather than SQL text, because three artefacts have to agree — this list, the
 * `INSERT`'s placeholder count, and `phraseToParams`' return — and only one of the three
 * can be authored. The other two are derived below, so a column added here without its
 * parameter is a COMPILE error rather than a row whose every later column holds its
 * neighbour's value.
 */
export const PHRASE_COLUMN_NAMES = [
  'id',
  'user_id',
  'phrase_id',
  'own_es',
  'own_en',
  'own_theme',
  'own_emoji',
  'source',
  'difficulty',
  'tags',
  'loved',
  'learned',
  'note',
  'plays',
  'reps',
  'added_at',
  'last_practiced_at',
  'graduated_at',
  'srs_stability',
  'srs_difficulty',
  'srs_due',
  'srs_last_review',
  'srs_lapses',
  'srs_state',
  'reps_today',
  'reps_today_day',
  'automaticity',
  'lock_in_days',
  'rung',
  'stumbles',
  'cue_level',
  'ax_perception',
  'ax_recall',
  'ax_production',
  'updated_hlc',
  'field_hlc',
  'deleted_at',
  'target_locale',
  'own_meaning_language',
  'srs_algorithm',
] as const

/**
 * One `SqlValue` per element of a column tuple — same length, positionally.
 *
 * Written over a type PARAMETER so the mapping is homomorphic: TypeScript then preserves
 * the tuple's length instead of mapping its array methods too. That length is the whole
 * point — it is what makes a missing parameter a type error.
 */
type ValuesFor<T extends readonly unknown[]> = { -readonly [K in keyof T]: SqlValue }

type PhraseParams = ValuesFor<typeof PHRASE_COLUMN_NAMES>

const PHRASE_COLUMNS = PHRASE_COLUMN_NAMES.join(', ')

const PHRASE_PLACEHOLDERS = placeholders(PHRASE_COLUMN_NAMES.length)

/**
 * The columns an `upsert` does NOT own, and therefore must never write on conflict.
 *
 * `INSERT OR REPLACE` used to stand where the conflict clause below does, and it is a
 * DELETE followed by an INSERT: the existing row is dropped, so every column the incoming
 * row does not carry reverts to its DEFAULT. Two of them are not the caller's to reset.
 *
 *   • `field_hlc`  — the per-field merge history. `phraseToParams` binds `'{}'`, so a
 *                    replace erased whatever `POST /sync/pull` had recorded, and the next
 *                    merge would treat every field as never having been written. A local
 *                    write owns `updated_hlc`; it does not own the other device's clocks.
 *   • `deleted_at` — the tombstone. `phraseToParams` binds `NULL`, so a replace RESURRECTED
 *                    a deleted row: `tombstone` is the one class that beats a concurrent
 *                    edit at any HLC (docs/architecture/sync-protocol.md#per-field-lww),
 *                    and a plain re-add of a row the learner deleted silently undid the
 *                    deletion — on this device and, once the outbox drains, on every other.
 *
 * `id` is the conflict target. `user_id` is ownership: a content write is not a transfer,
 * and leaving it out means one learner's row cannot be reassigned by writing over it.
 *
 * Derived from `PHRASE_COLUMN_NAMES` rather than listed again, so a column added there
 * joins the update automatically — the failure mode of a hand-copied SET list is a new
 * field that persists on insert and is silently dropped on every write after the first.
 */
const PHRASE_UPSERT_PRESERVES: ReadonlySet<string> = new Set([
  'id',
  'user_id',
  'field_hlc',
  'deleted_at',
])

const PHRASE_UPSERT_SET = PHRASE_COLUMN_NAMES.filter((c) => !PHRASE_UPSERT_PRESERVES.has(c))
  .map((c) => `${c} = excluded.${c}`)
  .join(', ')

/** Every read filters to the live rows of one learner; only the tail differs. */
const PHRASE_SELECT = `SELECT ${PHRASE_COLUMNS} FROM user_phrase
       WHERE user_id = ? AND deleted_at IS NULL`

export function rowToPhrase(row: SqlRow): PhraseState {
  const stability = readRealOrNull(row, 'srs_stability')
  const due = readIntOrNull(row, 'srs_due')
  // FSRS state exists only when the algorithm actually ran. A row with a due date but no
  // stability is not a schedule, and must not be presented as one.
  const srs: FsrsState | null =
    stability === null || due === null
      ? null
      : {
          ...(readTextOrNull(row, 'srs_algorithm')
            ? { algorithm: readText(row, 'srs_algorithm') }
            : {}),
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

  const targetLocale = readTextOrNull(row, 'target_locale')
  const ownMeaningLanguage = readTextOrNull(row, 'own_meaning_language')
  return {
    ...(targetLocale && isTargetLocale(targetLocale) ? { targetLocale } : {}),
    ...(ownMeaningLanguage && isNativeLanguage(ownMeaningLanguage) ? { ownMeaningLanguage } : {}),
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

export function phraseToParams(p: PhraseState, userId: string, hlc: string): PhraseParams {
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
    // INSERT-only defaults. A fresh row has no merge history and is not deleted; on
    // conflict both columns are left alone — see `PHRASE_UPSERT_PRESERVES`.
    '{}',
    null,
    p.targetLocale ?? null,
    p.ownMeaningLanguage ?? null,
    p.srs?.algorithm ?? null,
  ]
}

export class SqlPhraseTable implements PhraseTable {
  constructor(private readonly deps: SyncedTableDeps) {}

  /** `PHRASE_SELECT` plus this query's own predicate and ordering. */
  private select(tail: string, params: readonly SqlValue[] = []): PhraseState[] {
    return this.deps.driver
      .all(`${PHRASE_SELECT} ${tail}`, [this.deps.userId, ...params])
      .map(rowToPhrase)
  }

  hasCatalog(id: string, target: TargetLocale): boolean {
    return (
      firstRow(
        this.deps.driver,
        `SELECT id FROM user_phrase WHERE user_id = ? AND phrase_id = ? AND COALESCE(target_locale, 'es-ES') = ? LIMIT 1`,
        [this.deps.userId, id, target],
      ) !== null
    )
  }

  all(): PhraseState[] {
    return this.select('ORDER BY id')
  }

  byId(id: UserPhraseId): PhraseState | null {
    return this.select('AND id = ?', [id])[0] ?? null
  }

  active(): PhraseState[] {
    return this.select('AND learned = 0 AND graduated_at IS NULL ORDER BY id')
  }

  due(at: number): PhraseState[] {
    return this.select(
      'AND learned = 0 AND srs_due IS NOT NULL AND srs_due <= ? ORDER BY srs_due',
      [at],
    )
  }

  /**
   * Insert the row, or update the columns this write owns.
   *
   * The conflict target is `id` alone, so a SECOND row id claiming a catalog phrase the
   * learner already holds live raises the unique-index error rather than replacing the
   * existing row — `INSERT OR REPLACE` used to discard that row and its history without a
   * word (docs/architecture/data-model.md). Reconciling two ids for one phrase is plans
   * 67–68's decision, and an exception is the honest interim answer.
   */
  upsert(phrase: PhraseState): void {
    const existing = firstRow(this.deps.driver, 'SELECT user_id FROM user_phrase WHERE id = ?', [
      phrase.id,
    ])
    if (existing && readText(existing, 'user_id') !== this.deps.userId)
      throw new Error('Phrase belongs to another local owner')
    this.deps.driver.run(
      `INSERT INTO user_phrase (${PHRASE_COLUMNS}) VALUES (${PHRASE_PLACEHOLDERS})
       ON CONFLICT(id) DO UPDATE SET ${PHRASE_UPSERT_SET} WHERE user_phrase.user_id = excluded.user_id`,
      phraseToParams(phrase, this.deps.userId, this.deps.hlc()),
    )
  }

  /**
   * Stamp the tombstone, once.
   *
   * `deleted_at IS NULL` makes a repeat delete a no-op rather than moving the recorded
   * instant forward. A tombstone that keeps getting newer would eventually outrank a
   * legitimate later write, and the in-memory table (a `Set`) was already idempotent — so
   * the two implementations disagreed about what deleting twice means.
   */
  softDelete(id: UserPhraseId, at: number): void {
    this.deps.driver.run(
      `UPDATE user_phrase SET deleted_at = ?, updated_hlc = ?
       WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
      [at, this.deps.hlc(), this.deps.userId, id],
    )
  }

  restore(id: UserPhraseId): void {
    this.deps.driver.run(
      'UPDATE user_phrase SET deleted_at = NULL, updated_hlc = ? WHERE user_id = ? AND id = ?',
      [this.deps.hlc(), this.deps.userId, id],
    )
  }

  count(): number {
    const row = firstRow(
      this.deps.driver,
      'SELECT COUNT(*) AS n FROM user_phrase WHERE user_id = ? AND deleted_at IS NULL',
      [this.deps.userId],
    )
    return row === null ? 0 : readInt(row, 'n')
  }
}
