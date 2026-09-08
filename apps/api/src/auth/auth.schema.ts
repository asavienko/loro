/** F-01/F-02/F-07: account identity never derives from a client's anonymous ID. */
export const AUTH_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  created_at bigint NOT NULL
);
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
`
