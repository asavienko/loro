/** Local listen-queue playlist. Not a sync entity — no `field_hlc` / `deleted_at`. */
import type { TargetLocale } from '../../domain/languages.js'
import { firstRow, readText } from '../driver.js'
import type { SqlDriver } from '../driver.js'
import {
  decodeListenQueue,
  encodeListenQueue,
  listenQueueKey,
  type ListenQueue,
} from '../listenQueue.js'

export function loadListenQueue(
  driver: SqlDriver,
  userId: string,
  targetLocale: TargetLocale,
): ListenQueue | null {
  const row = firstRow(
    driver,
    'SELECT value FROM local_metadata WHERE user_id = ? AND key = ?',
    [userId, listenQueueKey(targetLocale)],
  )
  if (row === null) return null
  return decodeListenQueue(readText(row, 'value'))
}

export function saveListenQueue(driver: SqlDriver, userId: string, queue: ListenQueue): void {
  const raw = encodeListenQueue(queue)
  driver.run(
    `INSERT INTO local_metadata(user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, listenQueueKey(queue.targetLocale), raw],
  )
}

export function clearListenQueue(
  driver: SqlDriver,
  userId: string,
  targetLocale: TargetLocale,
): void {
  driver.run('DELETE FROM local_metadata WHERE user_id = ? AND key = ?', [
    userId,
    listenQueueKey(targetLocale),
  ])
}
