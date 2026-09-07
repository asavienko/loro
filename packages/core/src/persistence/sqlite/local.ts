import type { SqlRow } from '../driver.js'
import type { TargetLocale } from '../../domain/languages.js'
import type { FsrsState } from '../../domain/phrase.js'
import { decodeCheckpoint, encodeCheckpoint, type CourseCheckpoint } from '../checkpoint.js'
import { firstRow, readText, readInt, readIntOrNull, readRealOrNull } from '../driver.js'
import type {
  MetadataTable,
  CheckpointTable,
  AttemptTable,
  ReviewTable,
  ReviewEvent,
} from '../tables.js'
import type { TableDeps } from './deps.js'

export class SqlMetadataTable implements MetadataTable {
  constructor(private readonly deps: TableDeps) {}
  get(key: string): string | null {
    const row = firstRow(
      this.deps.driver,
      'SELECT value FROM local_metadata WHERE user_id = ? AND key = ?',
      [this.deps.userId, key],
    )
    return row ? readText(row, 'value') : null
  }
  set(key: string, value: string): void {
    this.deps.driver.run(
      'INSERT INTO local_metadata(user_id,key,value) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value',
      [this.deps.userId, key, value],
    )
  }
  delete(key: string): void {
    this.deps.driver.run('DELETE FROM local_metadata WHERE user_id = ? AND key = ?', [
      this.deps.userId,
      key,
    ])
  }
}

export class SqlCheckpointTable implements CheckpointTable {
  constructor(private readonly deps: TableDeps) {}
  load(target: TargetLocale): CourseCheckpoint | null {
    const row = firstRow(
      this.deps.driver,
      'SELECT payload FROM session_checkpoint WHERE user_id = ? AND target_locale = ?',
      [this.deps.userId, target],
    )
    const value = row ? decodeCheckpoint(readText(row, 'payload')) : null
    return value?.targetLocale === target ? value : null
  }
  save(value: CourseCheckpoint): void {
    this.deps.driver.run(
      'INSERT INTO session_checkpoint(user_id,target_locale,payload) VALUES(?,?,?) ON CONFLICT(user_id,target_locale) DO UPDATE SET payload=excluded.payload',
      [this.deps.userId, value.targetLocale, encodeCheckpoint(value)],
    )
  }
  clear(target: TargetLocale): void {
    this.deps.driver.run('DELETE FROM session_checkpoint WHERE user_id = ? AND target_locale = ?', [
      this.deps.userId,
      target,
    ])
  }
}

export class SqlAttemptTable implements AttemptTable {
  constructor(private readonly deps: TableDeps) {}
  has(target: TargetLocale, attemptId: string): boolean {
    return (
      firstRow(
        this.deps.driver,
        'SELECT attempt_id FROM committed_attempt WHERE user_id=? AND target_locale=? AND attempt_id=?',
        [this.deps.userId, target, attemptId],
      ) !== null
    )
  }
  record(target: TargetLocale, attemptId: string): boolean {
    if (!attemptId || attemptId.length > 512) throw new Error('Invalid attempt identity')
    if (this.has(target, attemptId)) return false
    this.deps.driver.run(
      'INSERT INTO committed_attempt(user_id,target_locale,attempt_id) VALUES(?,?,?)',
      [this.deps.userId, target, attemptId],
    )
    return true
  }
}

export class SqlReviewTable implements ReviewTable {
  constructor(private readonly deps: TableDeps) {}
  append(event: ReviewEvent): void {
    validateReview(event)
    const s = event.state
    this.deps.driver.run(
      `INSERT INTO review_event(user_id,target_locale,attempt_id,phrase_id,reviewed_at,rating,algorithm,stability,difficulty,due,last_review,lapses,state)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        this.deps.userId,
        event.targetLocale,
        event.attemptId,
        event.phraseId,
        event.reviewedAt,
        event.rating,
        event.algorithm,
        s.stability,
        s.difficulty,
        s.due,
        s.lastReview,
        s.lapses,
        s.state,
      ],
    )
  }
  all(target: TargetLocale): ReviewEvent[] {
    return this.deps.driver
      .all(
        'SELECT * FROM review_event WHERE user_id=? AND target_locale=? ORDER BY reviewed_at,attempt_id',
        [this.deps.userId, target],
      )
      .map((row) => ({
        attemptId: readText(row, 'attempt_id'),
        targetLocale: target,
        phraseId: readText(row, 'phrase_id'),
        reviewedAt: readInt(row, 'reviewed_at'),
        rating: readInt(row, 'rating') as ReviewEvent['rating'],
        algorithm: readText(row, 'algorithm'),
        state: {
          stability: requiredReal(row, 'stability'),
          difficulty: requiredReal(row, 'difficulty'),
          due: readInt(row, 'due'),
          lastReview: readIntOrNull(row, 'last_review'),
          lapses: readInt(row, 'lapses'),
          state: readText(row, 'state') as FsrsState['state'],
          algorithm: readText(row, 'algorithm'),
        },
      }))
  }
}

export function validateReview(event: ReviewEvent): void {
  const s = event.state
  if (
    !event.attemptId ||
    !event.phraseId ||
    !event.algorithm ||
    ![1, 2, 3, 4].includes(event.rating) ||
    ![event.reviewedAt, s.stability, s.difficulty, s.due, s.lapses].every(Number.isFinite) ||
    (s.lastReview !== null && !Number.isFinite(s.lastReview)) ||
    s.stability <= 0 ||
    s.lapses < 0
  ) {
    throw new Error('Invalid scalar review event')
  }
}

function requiredReal(row: SqlRow, column: string): number {
  const value = readRealOrNull(row, column)
  if (value === null || !Number.isFinite(value)) throw new Error(`Invalid review ${column}`)
  return value
}
