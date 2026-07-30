/**
 * Sync arbitration — docs/architecture/sync-protocol.md
 *
 * Thin by design: all the merge logic is in `loro-core`, compiled to WASM. THE SERVER
 * RUNS THE SAME MERGE AS THE CLIENT. Two implementations of a conflict rule diverge, and
 * the divergence shows up months later as a learner losing a rating (ADR-0002).
 *
 * Held apart from the controller so it can be tested without HTTP, and so the store it
 * reads and writes is an injected `SyncRepository` rather than a `Map` it reached for.
 * The wire shapes live here too, next to the code that produces them — the controller
 * only names the routes.
 */

import { Inject, Injectable } from '@nestjs/common'
import { isSyncEntity, mergeClassFor, type MergeClass, type SyncEntity } from '@loro/core'
import { LoroError } from '../common/errors.js'
import { mergeAvailable, mergeRow, type FieldValue, type StoredRow } from './merge.js'
import { SYNC_REPOSITORY, type SyncRepository } from './sync.repository.js'

/**
 * The wire shape, as a client may actually send it — not as we wish it were. `fields`
 * is optional because a delete legitimately carries none, and because this is
 * untrusted input: the guards below have to survive it being absent.
 */
export interface PushOp {
  seq: number
  entity: string
  entity_id: string
  op: 'upsert' | 'delete'
  fields?: Record<string, FieldValue>
  deleted_at?: number | null
}

export interface PushBody {
  client_hlc?: string
  ops: PushOp[]
}

export interface PullBody {
  since?: string
  limit?: number
}

/** Why one op in a batch was not applied. The rest of the batch still is. */
export interface RejectedOp {
  seq: number
  code: string
  field?: string
}

export interface PushResponse {
  accepted: number[]
  rejected: RejectedOp[]
  conflicts: string[]
  server_hlc: string
  server_time: number
}

export interface PullResponse {
  changes: StoredRow[]
  next: string
  has_more: boolean
  server_hlc: string
}

export interface StatusResponse {
  merge: string
  entities: number
}

const MAX_OPS = 500

@Injectable()
export class SyncService {
  constructor(@Inject(SYNC_REPOSITORY) private readonly rows: SyncRepository) {}

  async push(body: PushBody): Promise<PushResponse> {
    const ops = body.ops
    if (!Array.isArray(ops)) throw new LoroError('VALIDATION_FAILED', "'ops' must be an array")
    if (ops.length > MAX_OPS) {
      throw new LoroError('VALIDATION_FAILED', `batch of ${ops.length} exceeds the ${MAX_OPS} cap`)
    }

    const accepted: number[] = []
    const rejected: RejectedOp[] = []
    const conflicts: string[] = []

    for (const op of ops) {
      // One bad op does not fail the batch: the client would retry the whole thing and
      // the bad op would fail again. Each is accepted or rejected on its own.
      if (!isSyncEntity(op.entity)) {
        rejected.push({ seq: op.seq, code: 'schema_unknown' })
        continue
      }

      const declared = declaredClasses(op.entity, op.fields ?? {})
      if (!declared.ok) {
        rejected.push({ seq: op.seq, code: 'VALIDATION_FAILED', field: declared.undeclared })
        continue
      }

      const local = (await this.rows.get(op.entity, op.entity_id)) ?? blankRow(op)
      const outcome = mergeRow(local, {
        entity: op.entity,
        id: op.entity_id,
        fields: op.fields ?? {},
        deleted_at: op.op === 'delete' ? (op.deleted_at ?? Date.now()) : (op.deleted_at ?? null),
        classes: declared.classes,
      })

      await this.rows.put(outcome.row)
      conflicts.push(...outcome.conflicts)
      accepted.push(op.seq)
    }

    return {
      accepted,
      rejected,
      conflicts,
      server_hlc: serverHlc(),
      // Lets the client detect its own clock skew.
      server_time: Date.now(),
    }
  }

  /**
   * `since` and `limit` are accepted and IGNORED, and `has_more` is always false: this
   * returns every row of every learner. A known defect with a plan of its own —
   * plans/06-fix-sync-pull-cursor-and-scoping.md — kept exactly as it was so that fix
   * is a behaviour change made deliberately, in one place, with its own tests.
   */
  async pull(_body: PullBody): Promise<PullResponse> {
    return {
      changes: await this.rows.all(),
      next: serverHlc(),
      has_more: false,
      server_hlc: serverHlc(),
    }
  }

  /** Diagnostic: is the shared Rust merge actually loaded? */
  async status(): Promise<StatusResponse> {
    return {
      merge: mergeAvailable() ? 'loro-core (wasm)' : 'unavailable — run pnpm core-rs:build',
      entities: await this.rows.count(),
    }
  }
}

type DeclaredClasses =
  { ok: true; classes: Record<string, MergeClass> } | { ok: false; undeclared: string }

/**
 * EVERY field must have a declared merge class. An undeclared field is a silent
 * data-loss bug, so it is reported rather than guessed at — the first one found wins,
 * because the op is rejected whole either way.
 */
function declaredClasses(entity: SyncEntity, fields: Record<string, FieldValue>): DeclaredClasses {
  const classes: Record<string, MergeClass> = {}
  for (const field of Object.keys(fields)) {
    const cls = mergeClassFor(entity, field)
    if (cls === undefined) return { ok: false, undeclared: field }
    classes[field] = cls
  }
  return { ok: true, classes }
}

/** A row this server has never seen. The merge treats it as an empty local side. */
function blankRow(op: PushOp): StoredRow {
  return { entity: op.entity, id: op.entity_id, fields: {}, deleted_at: null }
}

/**
 * The server's HLC. `0000:srv` is a placeholder for a real logical counter and node id,
 * which arrive with persistence (plans/13) — the client only uses this to order and to
 * detect skew today.
 */
function serverHlc(): string {
  return `${Date.now()}:0000:srv`
}
