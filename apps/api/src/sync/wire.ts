import { ChangeSchema, type PullResponse } from '@loro/core/api/sync'
import { encodeHlc, type StoredRow } from './merge.js'
import type { SyncTransaction } from './sync.repository.js'

export function wireRow(row: StoredRow): PullResponse['changes'][number] {
  return ChangeSchema.parse({
    entity: row.entity,
    entity_id: row.id,
    deleted_at: row.deleted_at,
    ...(row.entity === 'user_phrase' &&
    row.deleted_at !== null &&
    typeof row.fields['phraseId']?.v === 'string'
      ? {
          catalog_identity: {
            phraseId: row.fields['phraseId'].v,
            targetLocale: row.fields['targetLocale']?.v,
          },
        }
      : {}),
    fields:
      row.deleted_at === null
        ? Object.fromEntries(
            Object.entries(row.fields).map(([key, field]) => [
              key,
              { v: field.v, hlc: encodeHlc(field.hlc) },
            ]),
          )
        : {},
  })
}

/** Historic append-only entries keep their content while references follow durable aliases. */
export async function canonicalReferences(
  tx: SyncTransaction,
  stored: StoredRow,
): Promise<StoredRow> {
  const row = structuredClone(stored)
  if (row.entity === 'user_phrase') row.id = await tx.canonical(row.id)
  else {
    const phrase = row.fields['phraseId']
    if (typeof phrase?.v === 'string') phrase.v = await tx.canonical(phrase.v)
    const set = row.fields['setIds']
    if (Array.isArray(set?.v))
      set.v = [...new Set(await Promise.all((set.v as string[]).map((id) => tx.canonical(id))))]
  }
  return row
}
