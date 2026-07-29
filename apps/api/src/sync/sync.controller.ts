/**
 * Sync — docs/architecture/sync-protocol.md
 *
 * Thin by design: all the logic is in `loro-core`, compiled to WASM. THE SERVER RUNS
 * THE SAME MERGE AS THE CLIENT. Two implementations of a conflict rule diverge, and
 * the divergence shows up months later as a learner losing a rating (ADR-0002).
 */

import { Body, Controller, Post } from '@nestjs/common'
import { FIELD_POLICY, mergeClassFor, type SyncEntity } from '@loro/core'
import { LoroError } from '../common/errors.js'
import { mergeRow, mergeAvailable, type FieldValue, type StoredRow } from './merge.js'

/**
 * The wire shape, as a client may actually send it — not as we wish it were. `fields`
 * is optional because a delete legitimately carries none, and because this is
 * untrusted input: the guards below have to survive it being absent.
 */
interface PushOp {
  seq: number
  entity: string
  entity_id: string
  op: 'upsert' | 'delete'
  fields?: Record<string, FieldValue>
  deleted_at?: number | null
}

interface PushBody {
  client_hlc?: string
  ops: PushOp[]
}

interface PullBody {
  since?: string
  limit?: number
}

const MAX_OPS = 500

/**
 * In-memory store. Postgres lands with persistence; the merge semantics this
 * endpoint enforces are already the real ones.
 */
const store = new Map<string, StoredRow>()

@Controller('sync')
export class SyncController {
  @Post('push')
  push(@Body() body: PushBody): {
    accepted: number[]
    rejected: { seq: number; code: string; field?: string }[]
    conflicts: string[]
    server_hlc: string
    server_time: number
  } {
    const ops = body.ops
    if (!Array.isArray(ops)) throw new LoroError('VALIDATION_FAILED', "'ops' must be an array")
    if (ops.length > MAX_OPS) {
      throw new LoroError('VALIDATION_FAILED', `batch of ${ops.length} exceeds the ${MAX_OPS} cap`)
    }

    const accepted: number[] = []
    const rejected: { seq: number; code: string; field?: string }[] = []
    const conflicts: string[] = []

    for (const op of ops) {
      if (!(op.entity in FIELD_POLICY)) {
        rejected.push({ seq: op.seq, code: 'schema_unknown' })
        continue
      }
      const entity = op.entity as SyncEntity

      // EVERY field must have a declared merge class. An undeclared field is a
      // silent data-loss bug, so it is rejected rather than guessed at.
      const classes: Record<string, string> = {}
      let bad: string | undefined
      for (const field of Object.keys(op.fields ?? {})) {
        const cls = mergeClassFor(entity, field)
        if (cls === undefined) {
          bad = field
          break
        }
        classes[field] = toWasmClass(cls)
      }
      if (bad !== undefined) {
        rejected.push({ seq: op.seq, code: 'VALIDATION_FAILED', field: bad })
        continue
      }

      const key = `${op.entity}:${op.entity_id}`
      const local: StoredRow = store.get(key) ?? {
        entity: op.entity,
        id: op.entity_id,
        fields: {},
        deleted_at: null,
      }

      const outcome = mergeRow(local, {
        entity: op.entity,
        id: op.entity_id,
        fields: op.fields ?? {},
        deleted_at: op.op === 'delete' ? (op.deleted_at ?? Date.now()) : (op.deleted_at ?? null),
        classes,
      })

      store.set(key, outcome.row)
      conflicts.push(...outcome.conflicts)
      accepted.push(op.seq)
    }

    return {
      accepted,
      rejected,
      conflicts,
      server_hlc: `${Date.now()}:0000:srv`,
      // Lets the client detect its own clock skew.
      server_time: Date.now(),
    }
  }

  @Post('pull')
  pull(@Body() _body: PullBody): {
    changes: StoredRow[]
    next: string
    has_more: boolean
    server_hlc: string
  } {
    return {
      changes: [...store.values()],
      next: `${Date.now()}:0000:srv`,
      has_more: false,
      server_hlc: `${Date.now()}:0000:srv`,
    }
  }

  /** Diagnostic: is the shared Rust merge actually loaded? */
  @Post('status')
  status(): { merge: string; entities: number } {
    return {
      merge: mergeAvailable() ? 'loro-core (wasm)' : 'unavailable — run pnpm core-rs:build',
      entities: store.size,
    }
  }
}

/** TS merge-class names → the Rust enum variants. */
function toWasmClass(cls: string): string {
  return (
    {
      lww: 'Lww',
      max: 'Max',
      'latest-review': 'LatestReview',
      'append-only': 'AppendOnly',
      tombstone: 'Tombstone',
    }[cls] ?? 'Lww'
  )
}
