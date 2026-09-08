-- Frozen native preview schema from dd841c9; version 3 on that installed branch.

      ALTER TABLE user_phrase ADD COLUMN srs_algorithm TEXT;
      ALTER TABLE outbox ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local';
      CREATE INDEX outbox_owner ON outbox(user_id, seq);
      CREATE TABLE local_metadata (
        user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      );
      CREATE TABLE session_checkpoint (
        user_id TEXT NOT NULL, target_locale TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY (user_id, target_locale)
      );
      CREATE TABLE committed_attempt (
        user_id TEXT NOT NULL, target_locale TEXT NOT NULL, attempt_id TEXT NOT NULL,
        PRIMARY KEY (user_id, target_locale, attempt_id)
      );
      CREATE TABLE review_event (
        user_id TEXT NOT NULL, target_locale TEXT NOT NULL, attempt_id TEXT NOT NULL,
        phrase_id TEXT NOT NULL, reviewed_at INTEGER NOT NULL, rating INTEGER NOT NULL,
        algorithm TEXT NOT NULL, stability REAL NOT NULL, difficulty REAL NOT NULL,
        due INTEGER NOT NULL, last_review INTEGER, lapses INTEGER NOT NULL, state TEXT NOT NULL,
        PRIMARY KEY (user_id, target_locale, attempt_id)
      );
    