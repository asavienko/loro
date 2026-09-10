import type { OutboxOp } from '@loro/core'
import { PushOpSchema, type PushOp } from '@loro/core/api/sync'

const JSON_FIELDS: Readonly<Record<string, readonly string[]>> = {
  user_phrase: ['tags'],
  settings: ['languagePair', 'waveTimes', 'notifications'],
  refrain_day: ['setIds', 'waves'],
}

/** Works in Hermes as well as browsers; does not depend on a TextEncoder polyfill. */
export function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/** Storage uses scalar SQL values; the shared wire uses typed arrays and objects. */
export function decodeField(entity: string, field: string, value: unknown): unknown {
  if (JSON_FIELDS[entity]?.includes(field) && typeof value === 'string') {
    const decoded: unknown = JSON.parse(value)
    if (entity === 'refrain_day' && field === 'waves' && Array.isArray(decoded)) {
      return decoded.map((wave: unknown) =>
        typeof wave === 'string' ? { wave, completedAt: null } : wave,
      )
    }
    return decoded
  }
  return value
}

export function outboxToWire(op: OutboxOp): PushOp {
  if (op.op === 'delete')
    return PushOpSchema.parse({
      seq: op.seq,
      entity: op.entity,
      entity_id: op.entityId,
      op: 'delete',
      deleted_at: op.fields['deletedAt']?.v ?? op.createdAt,
    })
  const fields = Object.fromEntries(
    Object.entries(op.fields).map(([field, write]) => [
      field,
      { v: decodeField(op.entity, field, write.v), hlc: write.hlc },
    ]),
  )
  // Only reviewed, implemented entities may cross this boundary. Unknown fields, private
  // recordings and consent flags fail shared validation and remain locally recoverable.
  return PushOpSchema.parse({
    seq: op.seq,
    entity: op.entity,
    entity_id: op.entityId,
    op: 'upsert',
    fields,
    ...(op.replaces ? { replaces: op.replaces } : {}),
  })
}
