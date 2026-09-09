import {
  mergeClassOf,
  PHRASE_WIRE_TO_SQL,
  SETTINGS_WIRE_TO_SQL,
  type MergeClass,
  type SqlDriver,
  type SqlRow,
  type SqlValue,
} from '@loro/core'
import { mergeRow } from '../../lib/core'
import { SyncError } from '../../lib/sync/types'

export interface Hlc {
  physical: number
  logical: number
  node_id: string
}
export interface Field {
  v: unknown
  hlc: Hlc
}
export interface Row {
  entity: string
  id: string
  fields: Record<string, Field>
  deleted_at: number | null
}

export function firstRow(
  driver: SqlDriver,
  sql: string,
  params: readonly SqlValue[] = [],
): SqlRow | null {
  return driver.all(sql, params)[0] ?? null
}

export function readText(row: SqlRow, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') throw new SyncError('INVALID_LOCAL_ROW')
  return value
}

export const RUST_CLASSES: Record<
  MergeClass,
  'Lww' | 'Max' | 'LatestReview' | 'AppendOnly' | 'Tombstone'
> = {
  lww: 'Lww',
  max: 'Max',
  'latest-review': 'LatestReview',
  'append-only': 'AppendOnly',
  tombstone: 'Tombstone',
}

export const PHRASE_COLUMNS = PHRASE_WIRE_TO_SQL
export const SETTINGS_COLUMNS = SETTINGS_WIRE_TO_SQL
export const BOOL_FIELDS = new Set([
  'loved',
  'learned',
  'engineExplicit',
  'analyticsOptOut',
  'practised',
  'notifications',
])
export const REVIEW_RATINGS: Readonly<Record<string, number>> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
}

export function parseHlc(value: string): Hlc {
  const parts = value.split(':')
  if (parts.length !== 3 || !parts[2]) throw new SyncError('INVALID_HLC')
  return { physical: Number(parts[0]), logical: Number(parts[1]), node_id: parts[2] }
}

export function encodeHlc(value: Hlc): string {
  return `${value.physical}:${String(value.logical).padStart(4, '0')}:${value.node_id}`
}

export function blank(entity: string, id: string): Row {
  return { entity, id, fields: {}, deleted_at: null }
}

export function sqlValue(value: unknown): SqlValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON.stringify(value)
}

export function merge(local: Row, remote: Row): Row {
  const classes = Object.fromEntries(
    Object.keys(remote.fields).map((field) => {
      const policy = mergeClassOf(remote.entity, field)
      if (!policy) throw new SyncError('UNKNOWN_FIELD')
      return [field, RUST_CLASSES[policy]]
    }),
  )
  return mergeRow(local, { ...remote, classes }).row
}
