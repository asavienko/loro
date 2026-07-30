/**
 * `outbox` — the queue every local write appends to.
 *
 * The folding rules live here rather than in the sync client because they are decided by
 * the MERGE CLASS of each field (`sync/fieldPolicy.ts`), and folding a field whose class
 * forbids it is a silent data-loss bug wearing a performance costume.
 */

import {
  firstRow,
  placeholders,
  readInt,
  readJson,
  readText,
  type SqlDriver,
  type SqlRow,
  type SqlValue,
} from '../driver.js'
import type { FieldWrite, OutboxAppend, OutboxOp, OutboxTable } from '../tables.js'
import { mergeClassOf } from '../../sync/fieldPolicy.js'

const OUTBOX_SELECT = `SELECT seq, entity, entity_id, op, payload, hlc, created_at, attempts FROM outbox`

/**
 * Whether a field may be folded into an already-queued op for the same row.
 *
 * Only `lww` may: the later value is the answer, so replacing the earlier one loses
 * nothing. `max` could be folded by taking the maximum, and compaction does exactly that
 * (`maxFolding`), but a plain replace would let a lower count overwrite a higher one —
 * which is the very bug the `max` class exists to prevent. `append-only` rows are a log;
 * folding two entries deletes one. `latest-review` must move as a group. `tombstone`
 * must not be merged with the edits it supersedes. An entity with no policy at all folds
 * nothing, because "unknown" is not a licence.
 */
function coalescable(entity: string, field: string): boolean {
  return mergeClassOf(entity, field) === 'lww'
}

/** `max` fields fold by taking the larger value, which is lossless. */
function maxFolding(entity: string, field: string): boolean {
  return mergeClassOf(entity, field) === 'max'
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
    const row = firstRow(
      this.driver,
      `${OUTBOX_SELECT}
       WHERE entity = ? AND entity_id = ? AND op = 'upsert'
       ORDER BY seq DESC LIMIT 1`,
      [entity, entityId],
    )
    return row === null ? null : rowToOp(row)
  }

  pending(limit: number): OutboxOp[] {
    return this.driver
      .all(
        `${OUTBOX_SELECT}
         ORDER BY seq LIMIT ?`,
        [limit],
      )
      .map(rowToOp)
  }

  ack(seqs: readonly number[]): void {
    if (seqs.length === 0) return
    this.driver.run(`DELETE FROM outbox WHERE seq IN (${placeholders(seqs.length)})`, seqs)
  }

  recordFailure(seqs: readonly number[], error: string): void {
    if (seqs.length === 0) return
    this.driver.run(
      `UPDATE outbox SET attempts = attempts + 1, last_error = ?
       WHERE seq IN (${placeholders(seqs.length)})`,
      [error, ...seqs] as SqlValue[],
    )
  }

  size(): number {
    const row = firstRow(this.driver, 'SELECT COUNT(*) AS n FROM outbox')
    return row === null ? 0 : readInt(row, 'n')
  }

  compact(maxOps: number): number {
    if (this.size() <= maxOps) return 0

    let removed = 0
    this.driver.transaction(() => {
      for (const ops of this.pendingUpsertsByRow().values()) {
        removed += this.foldForward(ops)
      }
    })
    return removed
  }

  /** Every queued upsert, grouped by the row it targets and kept in seq order. */
  private pendingUpsertsByRow(): Map<string, OutboxOp[]> {
    const groups = new Map<string, OutboxOp[]>()
    for (const op of this.pending(Number.MAX_SAFE_INTEGER)) {
      if (op.op !== 'upsert') continue
      const key = `${op.entity} ${op.entityId}`
      const list = groups.get(key) ?? []
      list.push(op)
      groups.set(key, list)
    }
    return groups
  }

  /**
   * Fold one row's queued upserts into the OLDEST of them, so queue order is preserved:
   * the server sees this row's change where it originally sat in the sequence.
   *
   * @returns how many ops were removed.
   */
  private foldForward(ops: readonly OutboxOp[]): number {
    if (ops.length < 2) return 0
    const target = ops[0]
    if (target === undefined) return 0

    const merged: Record<string, FieldWrite> = { ...target.fields }
    const dropped: number[] = []

    for (const later of ops.slice(1)) {
      if (!isFoldable(later)) break // stop at the first op that cannot be folded, keeping order

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
    }

    if (dropped.length === 0) return 0
    this.driver.run('UPDATE outbox SET payload = ? WHERE seq = ?', [
      JSON.stringify(merged),
      target.seq,
    ])
    this.ack(dropped)
    return dropped.length
  }
}

/** An op folds only if EVERY field it carries can be folded without losing information. */
function isFoldable(op: OutboxOp): boolean {
  return Object.entries(op.fields).every(
    ([field, write]) =>
      coalescable(op.entity, field) ||
      (maxFolding(op.entity, field) && typeof write.v === 'number'),
  )
}
