/** F-01/F-02/F-07: account identity never derives from a client's anonymous ID. */
export const AUTH_MIGRATION_SQL = `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass(format('%I.auth_sessions',current_schema()))
             AND attname='expires' AND NOT attisdropped) THEN
    IF to_regclass(format('%I.auth_sessions_legacy',current_schema())) IS NOT NULL THEN
      RAISE EXCEPTION 'Incompatible legacy authentication schemas require reconciliation';
    END IF;
    ALTER TABLE auth_sessions RENAME TO auth_sessions_legacy;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  created_at bigint
);
ALTER TABLE auth_users ALTER COLUMN created_at DROP NOT NULL;
CREATE TABLE IF NOT EXISTS auth_identities (
  provider text NOT NULL CHECK (provider IN ('apple','google','email')),
  subject text NOT NULL,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  PRIMARY KEY(provider, subject)
);
CREATE TABLE IF NOT EXISTS auth_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  app_version text NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE(user_id, installation_id),
  UNIQUE(id,user_id)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  revoked_at bigint,
  FOREIGN KEY(device_id,user_id) REFERENCES auth_devices(id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  token_hash text PRIMARY KEY,
  session_id text NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL,
  consumed_at bigint
);
CREATE INDEX IF NOT EXISTS auth_refresh_session ON auth_refresh_tokens(session_id);
CREATE TABLE IF NOT EXISTS auth_legacy_upgrades (
  legacy_session_id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auth_magic_codes (
  email_hash text PRIMARY KEY,
  code_hash text NOT NULL,
  nonce text NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket text PRIMARY KEY,
  count integer NOT NULL,
  expires_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_claims (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  request_id text NOT NULL,
  anon_id text NOT NULL,
  created_at bigint NOT NULL,
  FOREIGN KEY(device_id,user_id) REFERENCES auth_devices(id,user_id) ON DELETE CASCADE,
  UNIQUE(user_id,device_id,request_id)
);
CREATE TABLE IF NOT EXISTS oauth_attempts (
  hash text PRIMARY KEY,
  provider text NOT NULL CHECK(provider IN ('google','apple')),
  nonce text NOT NULL,
  verifier text NOT NULL,
  challenge text NOT NULL,
  redirect text NOT NULL,
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_grants (
  hash text PRIMARY KEY,
  provider text NOT NULL CHECK(provider IN ('google','apple')),
  subject text NOT NULL,
  challenge text NOT NULL,
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_migrations (id text PRIMARY KEY);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_migrations WHERE id='legacy-auth-v1') THEN
    IF to_regclass(format('%I.auth_accounts',current_schema())) IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM auth_accounts a JOIN auth_identities i
                 ON i.provider=a.provider AND i.subject=a.subject WHERE i.user_id<>a.id::text) THEN
        RAISE EXCEPTION 'Legacy identity collision requires explicit reconciliation';
      END IF;
      INSERT INTO auth_users(id,created_at)
        SELECT id::text,NULL FROM auth_accounts ON CONFLICT(id) DO NOTHING;
      INSERT INTO auth_identities(provider,subject,user_id)
        SELECT provider,subject,id::text FROM auth_accounts ON CONFLICT(provider,subject) DO NOTHING;
      IF to_regclass(format('%I.auth_grants',current_schema())) IS NOT NULL THEN
        INSERT INTO oauth_grants(hash,provider,subject,challenge,expires)
          SELECT g.hash,a.provider,a.subject,g.challenge,g.expires
          FROM auth_grants g JOIN auth_accounts a ON a.id=g.user_id ON CONFLICT(hash) DO NOTHING;
      END IF;
    END IF;
    IF to_regclass(format('%I.auth_attempts',current_schema())) IS NOT NULL THEN
      INSERT INTO oauth_attempts(hash,provider,nonce,verifier,challenge,redirect,expires)
        SELECT hash,provider,nonce,verifier,challenge,redirect,expires
        FROM auth_attempts ON CONFLICT(hash) DO NOTHING;
    END IF;
    INSERT INTO auth_migrations(id) VALUES('legacy-auth-v1');
  END IF;
END $$;
`
