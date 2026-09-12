import { describe, expect, it } from 'vitest'
import type { SqlConnection, SqlResult } from './database.js'
import { applyNamedMigrations, type NamedMigration } from './migrations.js'

function memoryConnection(): SqlConnection & { sql: string[] } {
  const ledger = new Set<string>()
  const sql: string[] = []
  return {
    sql,
    query<T = Record<string, unknown>>(
      statement: string,
      values?: readonly unknown[],
    ): Promise<SqlResult<T>> {
      sql.push(statement)
      if (statement.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
        return Promise.resolve({ rows: [] as T[], rowCount: 0 })
      }
      if (statement.startsWith('SELECT id FROM schema_migrations')) {
        return Promise.resolve({
          rows: [...ledger].map((id) => ({ id })) as T[],
          rowCount: ledger.size,
        })
      }
      if (statement.startsWith('INSERT INTO schema_migrations')) {
        ledger.add(String(values?.[0]))
        return Promise.resolve({ rows: [] as T[], rowCount: 1 })
      }
      if (statement === 'FAIL') return Promise.reject(new Error('migration failed'))
      return Promise.resolve({ rows: [] as T[], rowCount: 0 })
    },
  }
}

const first: NamedMigration = { id: '001_auth', sql: 'AUTH' }
const second: NamedMigration = { id: '002_sync', sql: 'SYNC' }

describe('applyNamedMigrations', () => {
  it('applies a fresh install in order and is a no-op on repeat boot', async () => {
    const connection = memoryConnection()
    expect(await applyNamedMigrations(connection, [first, second], 10)).toEqual([
      '001_auth',
      '002_sync',
    ])
    expect(connection.sql.filter((statement) => statement === 'AUTH')).toHaveLength(1)
    expect(await applyNamedMigrations(connection, [first, second], 20)).toEqual([])
  })

  it('records only earlier versions when a later migration fails', async () => {
    // Atomicity is the wrapping BEGIN/COMMIT in PostgresDatabase, not this helper.
    const connection = memoryConnection()
    await expect(
      applyNamedMigrations(connection, [first, { id: '002_bad', sql: 'FAIL' }], 10),
    ).rejects.toThrow('migration failed')
    expect(await applyNamedMigrations(connection, [first], 11)).toEqual([])
  })
})
