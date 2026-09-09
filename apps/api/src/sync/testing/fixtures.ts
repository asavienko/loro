import type { PushOp } from '@loro/core/api/target'

export const testRowId = (n: number): string =>
  `0197f2a0-0000-7000-8000-${String(n).padStart(12, '0')}`

export const fieldValue = <T>(v: T, at = 1000) => ({ v, hlc: `${at}:0000:device-a` })

export const syncEnvelope = (ops: unknown[]) => ({ client_hlc: '1000:0000:device-a', ops })

export type PhraseUpsert = Extract<PushOp, { entity: 'user_phrase'; op: 'upsert' }>
type PhraseFields = PhraseUpsert['fields']

export const phraseUpsert = (
  seq: number,
  row = testRowId(seq),
  fields: PhraseFields = { reps: fieldValue(1) },
): PhraseUpsert => ({
  seq,
  entity: 'user_phrase',
  entity_id: row,
  op: 'upsert',
  fields: {
    targetLocale: fieldValue('es-ES'),
    source: fieldValue('starter'),
    addedAt: fieldValue(1000),
    phraseId: fieldValue(null),
    ownEs: fieldValue('Un café'),
    ...fields,
  },
})
