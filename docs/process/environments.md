# Environments

Four target environments, one production promotion path.

**Selected testing exception, not yet provisioned:**
[Plan 88](../../plans/88-low-cost-backend-infrastructure.md) defines one shared `testing` environment
in Frankfurt: one EC2 instance with local PostgreSQL, private S3 and a $25–35/month target. Deploys
are manual after required CI; short maintenance downtime and synthetic test data are accepted. It
does not provision separate dev/staging stacks or their managed services. Shared API access waits
for authentication, tenant isolation and durable storage; mobile sync has its own additional gates.
The tables and promotion path below describe the later target environments.

---

## The environments

|                  | `local`         | `dev`                 | `staging`              | `production`       |
| ---------------- | --------------- | --------------------- | ---------------------- | ------------------ |
| **API**          | localhost:3000  | `api-dev.loro.app`    | `api-staging.loro.app` | `api.loro.app`     |
| **Database**     | Docker Postgres | Managed, small        | Managed, prod-shaped   | Managed, HA + PITR |
| **Redis**        | Docker          | Managed, small        | Managed                | Managed, AOF       |
| **Storage**      | MinIO           | Bucket + CDN          | Bucket + CDN           | Bucket + CDN       |
| **AI provider**  | **Stub**        | Real, low budget      | Real, prod budget      | Real               |
| **TTS provider** | **Stub**        | Real, low budget      | Real                   | Real               |
| **Content**      | Seeded fixture  | Latest, unreviewed OK | **Production catalog** | Production catalog |
| **App build**    | Dev client      | `preview`             | `staging`              | `production`       |
| **Analytics**    | Console only    | Dev project           | Staging project        | Production project |
| **Learner data** | Fixtures        | Synthetic             | **Synthetic only**     | Real               |
| **Deploys**      | —               | On push to `main`     | On push to `main`      | Manual approval    |
| **Who**          | Everyone        | Everyone              | Team + testers         | Learners           |

---

## `local`

**Design goal: works offline, needs no API keys, costs nothing.**

```bash
pnpm --filter api dev:up      # postgres, redis, minio
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api dev
pnpm --filter mobile ios      # or android
```

**AI and TTS are stubbed** (`AI_PROVIDER=stub`, `TTS_PROVIDER=stub`), returning the bundled fallback
fixtures. That means a new developer needs no credentials on day one, and it also means the fallback
path is exercised constantly and can't silently rot
([`../architecture/ai-services.md`](../architecture/ai-services.md#bundled-fallback)).

Hitting real providers requires an explicit env change and your own key. Nobody does this by
accident.

**Seed data** reproduces the blueprint's `LORO_SEED` (`Loro.dc.html:2873–2884`) — 10 phrases with
real difficulties, tags, and rep counts — so every screen has plausible data without tapping through
onboarding.

### Device on a LAN

A physical device can't reach `localhost`:

```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

---

## `dev`

The integration environment. Deploys automatically from `main`, and **is allowed to be broken** —
that's what it's for.

- Unreviewed content can be published here to see how it looks in the app.
- Low AI/TTS budgets, because experiments happen here.
- Data is wiped weekly; nobody should have anything they care about in it.

---

## `staging`

**Production-shaped, and the release-candidate gate.** The manual release checklist runs here
([definition-of-done.md](definition-of-done.md#manual-gates--the-release-checklist)).

- Same infrastructure topology as production, smaller.
- **The production content catalog**, so what a tester sees is what learners will see.
- Real AI and TTS at production budgets, so cost and latency are representative.
- **Synthetic learner data only.** Never a copy of production
  ([`../architecture/security-privacy.md`](../architecture/security-privacy.md)).
- Distributed via TestFlight and the Play internal track.

The synthetic-data rule is worth stating plainly: copying production data into staging would put
real learners' phrase libraries — which include private memory hooks and photographed documents —
into a lower-trust environment. Instead there's a generator that produces realistic libraries at
realistic scale (including a 2 000-phrase account for performance testing).

---

## `production`

- Manual approval gate on deploy.
- Blue-green with health-gated cutover and automatic rollback
  ([ci-cd.md](ci-cd.md#backend-deploys)).
- HA Postgres with PITR (35 days).
- Full observability, SLO-based alerting, on-call
  ([`../architecture/observability.md`](../architecture/observability.md)).
- **No standing human access to the database.** Break-glass only, approved and audit-logged.

---

## Promotion

```
local  ──(PR)──▶  main  ──(auto)──▶  dev  ──(auto)──▶  staging  ──(approval)──▶  production
                    │                                      │
                    │                              manual release gates
                    └──(cut)──▶ release/x.y ──(tag)──▶ store
```

Nothing skips staging. A hotfix goes through it too — faster, but through it
([release-versioning.md](release-versioning.md#hotfixes)).

---

## Configuration

Everything is environment variables. No environment-specific code branches, ever — a
`if (env === 'production')` in application code is a bug, because it means staging isn't testing
what production runs.

### API

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://…
REDIS_URL=redis://…
S3_ENDPOINT=…
S3_BUCKET=…
CDN_BASE_URL=https://cdn.loro.app

JWT_PRIVATE_KEY=…            # ES256, from the secret store
JWT_PUBLIC_KEY=…
REFRESH_TOKEN_PEPPER=…

AI_PROVIDER=anthropic         # anthropic | stub
ANTHROPIC_API_KEY=…
AI_MONTHLY_BUDGET_USD_PER_USER=0.50
AI_DAILY_BUDGET_USD_GLOBAL=200

TTS_PROVIDER=neural           # neural | stub
TTS_API_KEY=…

APPLE_TEAM_ID=…               # receipt verification
GOOGLE_PLAY_SA_JSON=…

OTEL_EXPORTER_OTLP_ENDPOINT=…
SENTRY_DSN=…
LOG_LEVEL=info
```

### Mobile

Only `EXPO_PUBLIC_*` values reach the bundle, and **none of them is a secret**
([`../architecture/security-privacy.md`](../architecture/security-privacy.md#encryption)):

```bash
EXPO_PUBLIC_API_URL=https://api.loro.app
EXPO_PUBLIC_CDN_URL=https://cdn.loro.app
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_SENTRY_DSN=…       # public by design
```

**There is no provider API key in the app.** Every third-party call is proxied through our API,
which is what makes rate limiting, budget enforcement, and key rotation possible at all.

### Secrets

| Where    | How                                                                  |
| -------- | -------------------------------------------------------------------- |
| Local    | `.env`, gitignored, from `.env.example`                              |
| CI       | GitHub environment secrets; production requires reviewer approval    |
| Cloud    | Managed secret store, injected at runtime, never baked into an image |
| Rotation | Quarterly, and immediately on any suspicion                          |

`.env.example` files are committed with placeholder values and a comment per variable. A new
variable added without updating `.env.example` fails CI.

---

## Test accounts

| Account              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `qa+empty@loro.app`  | Fresh, no onboarding — tests the first-run path |
| `qa+seed@loro.app`   | The blueprint's 10 seeded phrases               |
| `qa+large@loro.app`  | 2 000 phrases — performance and scale           |
| `qa+trip@loro.app`   | A 12-day countdown, mid-flight                  |
| `qa+abroad@loro.app` | Trip state `abroad` — survival mode             |
| `qa+plus@loro.app`   | Entitled to Plus                                |

Available on `dev` and `staging`, recreated nightly from generators so they can't drift into a weird
state that hides a bug.

---

## Data handling

| Rule                                          |                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production data never leaves production**   | No copies to staging, no local restores, no dumps in tickets                                                                                                        |
| Synthetic data is generated, not derived      | A generator producing realistic libraries at realistic scale                                                                                                        |
| Backups are encrypted, access is audit-logged | Restore requires break-glass approval                                                                                                                               |
| Debugging a learner's issue                   | Their own diagnostics bundle, which they see and share deliberately ([`../architecture/observability.md`](../architecture/observability.md#structured-client-logs)) |

That last row is how a support case gets debugged without anyone reading a learner's phrase library:
the diagnostics bundle is a ring buffer of scalar events, learner-initiated, with the content shown
before sharing.
