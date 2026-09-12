/** OAuth handoffs share the same migrated PostgreSQL connection as sessions and sync. */
import type { OAuthProvider } from '@loro/core/api/oauth'
import type { SqlConnection, SqlDatabase } from '../database/database.js'
export interface Attempt {
  hash: string
  provider: OAuthProvider
  nonce: string
  verifier: string
  challenge: string
  redirect: string
  expires: number
}
export class OAuthRepository {
  constructor(private readonly database: SqlDatabase) {}
  async saveAttempt(a: Attempt): Promise<void> {
    await this.database.query(
      'INSERT INTO oauth_attempts(hash,provider,nonce,verifier,challenge,redirect,expires) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [a.hash, a.provider, a.nonce, a.verifier, a.challenge, a.redirect, a.expires],
    )
  }
  async consumeAttempt(
    hash: string,
    provider: OAuthProvider,
    now: number,
  ): Promise<Attempt | undefined> {
    return (
      await this.database.query<Attempt>(
        'DELETE FROM oauth_attempts WHERE hash=$1 AND provider=$2 AND expires>$3 RETURNING *',
        [hash, provider, now],
      )
    ).rows[0]
  }
  async saveGrant(
    hash: string,
    provider: OAuthProvider,
    subject: string,
    challenge: string,
    expires: number,
  ): Promise<void> {
    await this.database.query(
      'INSERT INTO oauth_grants(hash,provider,subject,challenge,expires) VALUES($1,$2,$3,$4,$5)',
      [hash, provider, subject, challenge, expires],
    )
  }
  async consumeGrant(
    connection: SqlConnection,
    hash: string,
    challenge: string,
    now: number,
  ): Promise<{ provider: OAuthProvider; subject: string } | undefined> {
    return (
      await connection.query<{ provider: OAuthProvider; subject: string }>(
        'DELETE FROM oauth_grants WHERE hash=$1 AND challenge=$2 AND expires>$3 RETURNING provider,subject',
        [hash, challenge, now],
      )
    ).rows[0]
  }

  async cleanup(now: number): Promise<void> {
    await this.database.transaction(async (connection) => {
      await connection.query('DELETE FROM oauth_attempts WHERE expires<=$1', [now])
      await connection.query('DELETE FROM oauth_grants WHERE expires<=$1', [now])
      await connection.query('DELETE FROM auth_rate_limits WHERE expires_at<=$1', [now])
    })
  }
}
