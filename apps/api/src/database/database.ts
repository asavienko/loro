/** F-04: a durable database is mandatory for account and sync operations. */
import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { Pool, type PoolClient } from 'pg'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'
import { DATABASE_MIGRATION_SQL } from './schema.js'

export interface SqlResult<T> {
  rows: T[]
  rowCount: number | null
}
export interface SqlConnection {
  query<T = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<T>>
}
export interface SqlDatabase extends SqlConnection {
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>
  ready(): Promise<boolean>
}
export const DATABASE = Symbol('Database')

function connection(client: Pool | PoolClient): SqlConnection {
  return {
    async query<T>(sql: string, values?: readonly unknown[]): Promise<SqlResult<T>> {
      const result = await client.query(sql, values === undefined ? undefined : [...values])
      return { rows: result.rows as T[], rowCount: result.rowCount }
    },
  }
}

@Injectable()
export class PostgresDatabase implements SqlDatabase, OnModuleDestroy {
  private pool: Pool | undefined
  private initialized: Promise<void> | undefined

  private async initialize(): Promise<Pool> {
    const url = config.databaseUrl()
    if (!url) throw new LoroError('PROVIDER_UNAVAILABLE', 'Durable database is not configured')
    this.pool ??= new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 })
    const pool = this.pool
    this.initialized ??= (async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT pg_advisory_xact_lock(hashtext('loro-schema-v1'))")
        await client.query(DATABASE_MIGRATION_SQL)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    })().catch((error: unknown) => {
      this.initialized = undefined
      throw error
    })
    await this.initialized
    return pool
  }

  async query<T>(sql: string, values?: readonly unknown[]): Promise<SqlResult<T>> {
    return connection(await this.initialize()).query<T>(sql, values)
  }

  async transaction<T>(work: (client: SqlConnection) => Promise<T>): Promise<T> {
    const client = await (await this.initialize()).connect()
    try {
      await client.query('BEGIN')
      const result = await work(connection(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async ready(): Promise<boolean> {
    try {
      await this.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end()
  }
}
