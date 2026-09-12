import type { PushOp } from '@loro/core/api/sync'
import type { StoredRow } from './merge.js'

export function phraseIdentityInvalid(
  op: Extract<PushOp, { entity: 'user_phrase'; op: 'upsert' }>,
  existing: StoredRow | undefined,
): boolean {
  const missingIdentity =
    !existing &&
    (op.fields.phraseId === undefined ||
      op.fields.targetLocale === undefined ||
      op.fields.source === undefined ||
      op.fields.addedAt === undefined)
  const identityChanged = ['phraseId', 'targetLocale'].some((field) => {
    const value = (op.fields as Record<string, { v: unknown }>)[field]
    const previous = existing?.fields[field]
    return previous !== undefined && value !== undefined && previous.v !== value.v
  })
  return missingIdentity || identityChanged
}

export function phraseReplacementValid(
  op: Extract<PushOp, { entity: 'user_phrase'; op: 'upsert' }>,
  existing: StoredRow | undefined,
  previous: StoredRow | undefined,
  previousId: string,
): boolean {
  if (!op.replaces) return true
  return (
    existing?.deleted_at == null &&
    previous?.deleted_at === op.replaces.deleted_at &&
    typeof op.fields.phraseId?.v === 'string' &&
    previous.fields['phraseId']?.v === op.fields.phraseId.v &&
    previous.fields['targetLocale']?.v === op.fields.targetLocale?.v &&
    previousId !== op.entity_id
  )
}
