/** Deletions become permanent sync tombstones only after the authored Undo lifetime. */
import { LOCAL_USER_ID } from '@loro/core'
import { UNDO_TOAST_MS } from '../lib/toastTiming'
import { readLocalValue, writeLocalValue, type RuntimeDatabase } from './database'

const KEY = 'pending_phrase_deletes'
interface PendingDelete {
  at: number
  readyAt: number
}
type PendingDeletes = Record<string, PendingDelete>

function load(database: RuntimeDatabase): PendingDeletes {
  const raw = readLocalValue(database.driver, KEY)
  return raw === null ? {} : (JSON.parse(raw) as PendingDeletes)
}

/** Caller holds the phrase mutation transaction. */
export function deferPhraseDelete(database: RuntimeDatabase, id: string, at: number): void {
  writeLocalValue(
    database.driver,
    KEY,
    JSON.stringify({ ...load(database), [id]: { at, readyAt: at + UNDO_TOAST_MS } }),
  )
}

/** Refuse to resurrect any tombstone already handed to sync. */
export function undoPendingPhraseDelete(
  database: RuntimeDatabase,
  id: string,
  at: number,
): boolean {
  const pending = load(database)
  const entry = pending[id]
  if (!entry || entry.readyAt <= at) return false
  database.driver.run('UPDATE user_phrase SET deleted_at = NULL WHERE id = ? AND user_id = ?', [
    id,
    LOCAL_USER_ID,
  ])
  writeLocalValue(
    database.driver,
    KEY,
    JSON.stringify(Object.fromEntries(Object.entries(pending).filter(([key]) => key !== id))),
  )
  return true
}

/** Called on startup and before a sync flush; expiry is durable across process death. */
export function flushPendingDeletes(
  database: RuntimeDatabase,
  at: number,
  forceIds: readonly string[] = [],
): number {
  let count = 0
  database.driver.transaction(() => {
    const pending = load(database)
    const removed = new Set<string>()
    for (const [id, entry] of Object.entries(pending)) {
      if (entry.readyAt > at && !forceIds.includes(id)) continue
      const stamp = database.hlc()
      const raw = database.driver.all(
        'SELECT field_hlc FROM user_phrase WHERE id = ? AND user_id = ?',
        [id, LOCAL_USER_ID],
      )[0]?.['field_hlc']
      if (typeof raw === 'string') {
        const history: unknown = JSON.parse(raw)
        if (typeof history !== 'object' || history === null)
          throw new Error('Invalid phrase field clocks')
        database.driver.run(
          'UPDATE user_phrase SET field_hlc = ?, updated_hlc = ? WHERE id = ? AND user_id = ?',
          [JSON.stringify({ ...history, deletedAt: stamp }), stamp, id, LOCAL_USER_ID],
        )
        database.persistence.outbox.append({
          entity: 'user_phrase',
          entityId: id,
          op: 'delete',
          fields: { deletedAt: { v: entry.at, hlc: stamp } },
          hlc: stamp,
          createdAt: entry.at,
        })
        count++
      }
      removed.add(id)
    }
    if (removed.size > 0)
      writeLocalValue(
        database.driver,
        KEY,
        JSON.stringify(
          Object.fromEntries(Object.entries(pending).filter(([key]) => !removed.has(key))),
        ),
      )
  })
  return count
}
