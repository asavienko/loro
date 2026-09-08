/** Shared durable database port. Network work only happens after a local transaction commits. */
import type { Persistence, SqlDriver } from '@loro/core'

export interface RuntimeDatabase {
  readonly driver: SqlDriver
  readonly persistence: Persistence
  readonly deviceId: string
  /** Canonical Rust hybrid logical clock, persisted in the same transaction as each write. */
  readonly hlc: () => string
}

export function readLocalValue(driver: SqlDriver, key: string): string | null {
  const value = driver.all('SELECT v FROM kv WHERE k = ?', [key])[0]?.['v']
  return typeof value === 'string' ? value : null
}

export function writeLocalValue(driver: SqlDriver, key: string, value: string): void {
  driver.run('INSERT INTO kv(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [
    key,
    value,
  ])
}
