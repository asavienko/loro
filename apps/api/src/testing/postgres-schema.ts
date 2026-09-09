import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { describe } from 'vitest'

export const LORO_TEST_DATABASE_URL = process.env['LORO_TEST_DATABASE_URL']

export const describePostgres = describe.skipIf(!LORO_TEST_DATABASE_URL) as typeof describe

export function isolatedSchemaName(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`
}

export function connectAdmin(url = LORO_TEST_DATABASE_URL): Pool {
  if (!url) throw new Error('LORO_TEST_DATABASE_URL is not set')
  return new Pool({ connectionString: url })
}

export async function createIsolatedSchema(admin: Pool, schema: string): Promise<void> {
  await admin.query(`CREATE SCHEMA ${schema}`)
}

/** Create an isolated schema and return a connection URL scoped to its search_path. */
export async function createSearchPathSchema(
  admin: Pool,
  schema: string,
  url = LORO_TEST_DATABASE_URL,
): Promise<string> {
  if (!url) throw new Error('LORO_TEST_DATABASE_URL is not set')
  await createIsolatedSchema(admin, schema)
  const scoped = new URL(url)
  scoped.searchParams.set('options', `-csearch_path=${schema}`)
  return scoped.toString()
}

export async function dropIsolatedSchema(admin: Pool, schema: string): Promise<void> {
  await admin.query(`DROP SCHEMA ${schema} CASCADE`)
}
