/** F-04: authenticated, transactionally durable convergence through canonical Rust. */
import { createHash } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { mergeClassFor, type MergeClass } from '@loro/core'
import { canonicalJson } from './canonical-json.js'
import { phraseIdentityInvalid, phraseReplacementValid } from './phrase-identity.js'
import { canonicalReferences, wireRow } from './wire.js'
import {
  MAX_SYNC_BYTES,
  PushEnvelopeSchema,
  PullRequestSchema,
  validatePushBatch,
  type PushOp,
  type PushResponse,
  type PullResponse,
} from '@loro/core/api/sync'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import {
  advanceHlc,
  clampHlc,
  decodeHlc,
  mergeAvailable,
  mergeRow,
  type FieldValue,
} from './merge.js'
import {
  SYNC_REPOSITORY,
  type Alias,
  type ClockCorrection,
  type SyncRepository,
  type SyncTransaction,
} from './sync.repository.js'

export interface SyncPrincipal {
  userId: string
  deviceId: string
  sessionId: string
}
export interface StatusResponse {
  merge: string
  entities: number
}
export type { PushOp }

@Injectable()
export class SyncService {
  constructor(
    @Inject(SYNC_REPOSITORY) private readonly rows: SyncRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  async push(principal: SyncPrincipal, input: unknown): Promise<PushResponse> {
    const envelope = PushEnvelopeSchema.safeParse(input)
    if (!envelope.success) throw new LoroError('VALIDATION_FAILED', 'Invalid sync envelope')
    if (Buffer.byteLength(JSON.stringify(envelope.data)) > MAX_SYNC_BYTES)
      throw new LoroError('VALIDATION_FAILED', 'Sync batch exceeds the byte limit')
    const batch = validatePushBatch(envelope.data)
    if (!(await this.rows.consume(principal.userId, this.clock.now())))
      throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
    return this.rows.transaction(principal.userId, async (tx) => {
      const response: PushResponse = {
        accepted: [],
        rejected: batch.rejected,
        conflicts: [],
        aliases: [],
        clock_corrections: [],
        server_hlc: '',
        server_time: this.clock.now(),
      }
      const indices = new Map<number, number>()
      envelope.data.ops.forEach((value, index) => {
        if (
          value &&
          typeof value === 'object' &&
          'seq' in value &&
          typeof value.seq === 'number' &&
          !indices.has(value.seq)
        )
          indices.set(value.seq, index)
      })
      for (const op of batch.valid) {
        const digest = createHash('sha256').update(canonicalJson(op)).digest('hex')
        const replay = await tx.receipt(principal.deviceId, op.seq)
        if (replay) {
          if (replay.digest !== digest) {
            response.rejected.push({
              seq: op.seq,
              index: indices.get(op.seq) ?? 0,
              code: 'VALIDATION_FAILED',
            })
          } else {
            response.accepted.push(op.seq)
            response.conflicts.push(...replay.conflicts)
            response.aliases?.push(...replay.aliases)
            response.clock_corrections?.push(...replay.clockCorrections)
          }
          continue
        }
        if (op.entity === 'user_phrase' && op.op === 'upsert') {
          const existing = await tx.get(op.entity, await tx.canonical(op.entity_id))
          if (phraseIdentityInvalid(op, existing)) {
            response.rejected.push({
              seq: op.seq,
              index: indices.get(op.seq) ?? 0,
              code: 'VALIDATION_FAILED',
            })
            continue
          }
          if (op.replaces) {
            const previousId = await tx.canonical(op.replaces.id)
            const previous = await tx.get('user_phrase', previousId)
            if (!phraseReplacementValid(op, existing, previous, previousId)) {
              response.rejected.push({
                seq: op.seq,
                index: indices.get(op.seq) ?? 0,
                code: 'VALIDATION_FAILED',
              })
              continue
            }
          }
        }
        const aliases: Alias[] = []
        const clockCorrections: ClockCorrection[] = []
        const remote = await rowOp(tx, op, aliases, response.server_time, clockCorrections)
        const local = (await tx.get(remote.entity, remote.id)) ?? {
          entity: remote.entity,
          id: remote.id,
          fields: {},
          deleted_at: null,
        }
        const outcome = mergeRow(local, remote)
        if (outcome.changed) await tx.put(outcome.row)
        await tx.accept(principal.deviceId, op.seq, {
          digest,
          conflicts: outcome.conflicts,
          aliases,
          clockCorrections,
        })
        response.accepted.push(op.seq)
        response.conflicts.push(...outcome.conflicts)
        response.aliases?.push(...aliases)
        response.clock_corrections?.push(...clockCorrections)
      }
      response.server_hlc = advanceHlc(
        (await tx.head()).hlc,
        response.server_time,
        batch.client_hlc,
      )
      await tx.setHlc(response.server_hlc)
      return response
    })
  }

  async pull(principal: SyncPrincipal, input: unknown): Promise<PullResponse> {
    const parsed = PullRequestSchema.safeParse(input)
    if (!parsed.success) throw new LoroError('VALIDATION_FAILED', 'Invalid pull request')
    if (!(await this.rows.consume(principal.userId, this.clock.now())))
      throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
    return this.rows.transaction(principal.userId, async (tx) => {
      const head = await tx.head()
      const cursor =
        parsed.data.since === null
          ? { after: 0, watermark: null }
          : await tx.cursor(parsed.data.since)
      if (!cursor) throw new LoroError('CURSOR_EXPIRED')
      const watermark = cursor.watermark ?? head.revision
      const candidates = await tx.changes(cursor.after, watermark, parsed.data.limit + 1)
      const page = candidates.slice(0, parsed.data.limit)
      const has_more = candidates.length > parsed.data.limit
      const next = await tx.saveCursor({
        after: has_more ? (page.at(-1)?.revision ?? cursor.after) : watermark,
        watermark: has_more ? watermark : null,
      })
      const server_hlc = advanceHlc(head.hlc, this.clock.now())
      await tx.setHlc(server_hlc)
      return {
        changes: await Promise.all(
          page.map(async ({ row }) => wireRow(await canonicalReferences(tx, row))),
        ),
        aliases: await tx.aliases(),
        next,
        has_more,
        server_hlc,
      }
    })
  }

  async status(principal: SyncPrincipal): Promise<StatusResponse> {
    if (!(await this.rows.consume(principal.userId, this.clock.now())))
      throw new LoroError('RATE_LIMITED', undefined, { retry_after: 60 })
    return this.rows.transaction(principal.userId, async (tx) => ({
      merge: mergeAvailable() ? 'loro-core (wasm)' : 'unavailable',
      entities: await tx.count(),
    }))
  }
}

async function rowOp(
  tx: SyncTransaction,
  op: PushOp,
  aliases: Alias[],
  serverTime: number,
  clockCorrections: ClockCorrection[],
) {
  const fields: Record<string, FieldValue> = {}
  const classes: Record<string, MergeClass> = {}
  if (op.op === 'upsert') {
    for (const [key, field] of Object.entries(
      op.fields as Record<string, { v: unknown; hlc: string }>,
    )) {
      const cls = mergeClassFor(op.entity, key)
      if (cls === undefined) throw new LoroError('VALIDATION_FAILED', 'Undeclared sync field')
      const corrected = clampHlc(field.hlc, serverTime)
      if (corrected !== field.hlc)
        clockCorrections.push({ seq: op.seq, field: key, from: field.hlc, to: corrected })
      fields[key] = { v: field.v, hlc: decodeHlc(corrected) }
      classes[key] = cls
    }
  }
  let id = op.entity_id
  if (op.entity === 'user_phrase') {
    const existing = await tx.get('user_phrase', id)
    const locale = fields['targetLocale']?.v ?? existing?.fields['targetLocale']?.v
    const catalogId = fields['phraseId']?.v ?? existing?.fields['phraseId']?.v
    id = await tx.canonical(
      id,
      typeof locale === 'string' ? locale : undefined,
      typeof catalogId === 'string' ? catalogId : undefined,
      op.op === 'upsert' && op.replaces
        ? { ...op.replaces, id: await tx.canonical(op.replaces.id) }
        : undefined,
    )
    if (id !== op.entity_id) aliases.push({ from: op.entity_id, to: id })
  } else {
    // Log and Refrain references converge with their phrase; local recording paths
    // cannot enter here because the shared schemas reject undeclared fields.
    const phraseId = fields['phraseId']
    if (typeof phraseId?.v === 'string') phraseId.v = await tx.canonical(phraseId.v)
    const setIds = fields['setIds']
    if (Array.isArray(setIds?.v)) {
      const values = setIds.v as string[]
      setIds.v = [...new Set(await Promise.all(values.map((value) => tx.canonical(value))))]
    }
  }
  return {
    entity: op.entity,
    id,
    fields,
    classes,
    deleted_at: op.op === 'delete' ? op.deleted_at : null,
  }
}
