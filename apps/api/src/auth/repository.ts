/** F-01/F-07. PostgreSQL persistence; row locks serialize refresh rotation across API workers. */
import { Pool, type PoolClient } from 'pg'
import type { OAuthProvider } from '@loro/core/api/oauth'
export const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS auth_accounts (id uuid PRIMARY KEY, provider text NOT NULL, subject text NOT NULL, UNIQUE(provider, subject));
CREATE TABLE IF NOT EXISTS auth_attempts (hash text PRIMARY KEY, provider text NOT NULL, nonce text NOT NULL, verifier text NOT NULL, challenge text NOT NULL, redirect text NOT NULL, expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS auth_grants (hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth_accounts(id), challenge text NOT NULL, expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth_accounts(id), expires bigint NOT NULL, revoked boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS auth_refresh (hash text PRIMARY KEY, session_id uuid NOT NULL REFERENCES auth_sessions(id), consumed boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS auth_rates (key text PRIMARY KEY, hits integer NOT NULL, expires bigint NOT NULL);
`
export interface Attempt {
  hash: string
  provider: OAuthProvider
  nonce: string
  verifier: string
  challenge: string
  redirect: string
  expires: number
}
export interface Account {
  id: string
  provider: OAuthProvider
}
export class AuthRepository {
  constructor(readonly pool: Pool) {}
  async initialize(): Promise<void> {
    await this.pool.query(AUTH_SCHEMA)
  }
  async close(): Promise<void> {
    await this.pool.end()
  }
  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await run(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  async rate(key: string, now: number, limit: number): Promise<boolean> {
    const result = await this.pool.query<{ hits: number }>(
      `INSERT INTO auth_rates(key,hits,expires) VALUES($1,1,$2)
      ON CONFLICT(key) DO UPDATE SET hits = CASE WHEN auth_rates.expires <= $3 THEN 1 ELSE auth_rates.hits+1 END,
      expires = CASE WHEN auth_rates.expires <= $3 THEN $2 ELSE auth_rates.expires END RETURNING hits`,
      [key, now + 900_000, now],
    )
    return (result.rows[0]?.hits ?? limit + 1) <= limit
  }
  async saveAttempt(a: Attempt): Promise<void> {
    await this.pool.query(
      'INSERT INTO auth_attempts(hash,provider,nonce,verifier,challenge,redirect,expires) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [a.hash, a.provider, a.nonce, a.verifier, a.challenge, a.redirect, a.expires],
    )
  }
  async consumeAttempt(
    hash: string,
    provider: OAuthProvider,
    now: number,
  ): Promise<Attempt | undefined> {
    const result = await this.pool.query<Attempt>(
      'DELETE FROM auth_attempts WHERE hash=$1 AND provider=$2 AND expires>$3 RETURNING *',
      [hash, provider, now],
    )
    return result.rows[0]
  }
  async account(provider: OAuthProvider, subject: string, id: string): Promise<Account> {
    const result = await this.pool.query<Account>(
      `INSERT INTO auth_accounts(id,provider,subject) VALUES($1,$2,$3)
      ON CONFLICT(provider,subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id,provider`,
      [id, provider, subject],
    )
    const account = result.rows[0]
    if (!account) throw new Error('Missing account')
    return account
  }
  async saveGrant(hash: string, userId: string, challenge: string, expires: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO auth_grants(hash,user_id,challenge,expires) VALUES($1,$2,$3,$4)',
      [hash, userId, challenge, expires],
    )
  }
  async cleanup(now: number): Promise<void> {
    await this.transaction(async (c) => {
      await c.query('DELETE FROM auth_attempts WHERE expires<=$1', [now])
      await c.query('DELETE FROM auth_grants WHERE expires<=$1', [now])
      await c.query('DELETE FROM auth_rates WHERE expires<=$1', [now])
      await c.query(
        'DELETE FROM auth_refresh WHERE session_id IN (SELECT id FROM auth_sessions WHERE expires<=$1)',
        [now],
      )
      await c.query('DELETE FROM auth_sessions WHERE expires<=$1', [now])
    })
  }
}
export function postgresAuthRepository(url: string): AuthRepository {
  return new AuthRepository(
    new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 }),
  )
}
