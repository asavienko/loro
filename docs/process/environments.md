# Environments

Use local development today and one shared AWS testing environment when
[plan 88](../../plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md) is implemented. The
testing design is selected, but no cloud deployment, database integration or shared-user access is
established yet.

| Concern        | Local: implemented                                        | Testing: selected, not provisioned                         |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| API            | NestJS on port 3000; memory sync repository               | Same production image on one Frankfurt EC2 instance        |
| Database       | Optional Docker PostgreSQL; API does not connect yet      | PostgreSQL 16 on retained encrypted EC2 storage            |
| Object storage | Optional MinIO for adapter development                    | Private S3 content, backup and Terraform-state buckets     |
| AI / TTS       | Bundled AI scenes; TTS adapter stubbed, `/tts/render` 503 | AI remains stubbed; TTS disabled                           |
| Access         | Developer-only; current sync has no tenant boundary       | Small tester group after authentication and isolation pass |
| Deploy         | Host commands or root Docker Compose                      | Manual, immutable image, required CI, maintenance downtime |
| Data           | Local fixtures; memory state disappears on restart        | Synthetic data; nightly and pre-migration backups          |
| Cost           | No cloud services required                                | $25–35/month planning budget, excluding tax and providers  |

There is no separate cloud dev/staging stack, managed database, Redis, CDN or live-provider budget
in this phase. Historical environment names in workflow scaffolds are not deployed services.

## Local

For the implemented container workflow, see
[local containers and encrypted environment](local-development.md).

```bash
nvm use 22
pnpm local:up    # SOPS decrypt, image build, API + Expo web with health checks
```

Open <http://localhost:8081>. API readiness at <http://localhost:3000/v1/health/ready> must report
the WASM merge available. Optional PostgreSQL, Redis and MinIO services use the `infra` Compose
profile; the current API does not use them. Redis is an optional local tool, not a testing
infrastructure dependency.

For host development, use Node 22 with Cargo on PATH:

```bash
nvm use 22
export PATH="$HOME/.cargo/bin:$PATH"
pnpm core-rs:build
pnpm --filter @loro/api dev
```

See [the API guide](../../apps/api/README.md) for current routes and tests, and
[the mobile guide](../../apps/mobile/README.md) for running Expo.

There are no `db:migrate` or `db:seed` package scripts yet; starting containers does not make sync
durable. The bundled catalogs contain 31 phrases per target language. They are loaded from the
package, not seeded by a server database job. Bilingual review and audio capabilities have their own
gates. Setting a public API URL does not create the missing mobile HTTP/sync client. AI returns
bundled fixtures. The TTS adapter is stubbed (`TTS_PROVIDER=stub`); live ElevenLabs seed audio
remains Q-15. Cloud ASR is not a runtime.

## Testing

One `testing` environment in `eu-central-1`, with resource limits and staged access gates in
[plan 88](../../plans/archive/2026-09-09/88-low-cost-backend-infrastructure.md). Its hostname is an
input using an existing domain, not an assumed `loro.app` deployment.

1. Prepare infrastructure and test recovery with synthetic fixtures. Keep unfinished API routes
   inaccessible externally.
2. Enable shared API access only after plans 66/67 supply durable data, request validation,
   authentication and tenant isolation. Infrastructure credentials never substitute for user auth.
3. Enable mobile sync testing when the relevant device-persistence and convergence slices pass.
4. Enable S3 content delivery only through the approved adapters in plans 61/86. Until then, bundled
   content is the current implementation.

The [testing operations runbook](../runbooks/backend-testing.md) owns deployment, recovery,
monitoring and teardown. There is no automatic weekly wipe or set of pre-created QA accounts. Create
isolated empty, seeded and 2,000-phrase test accounts through the real auth/data path once it
exists. Do not reset tester data as part of deployment.

## Promotion

```text
local changes -> main + required CI -> manual testing deployment -> verified test evidence
```

Deploy the exact tested image digest; build once in CI. A code push alone does not deploy the API.
Current deployment workflows contain TODO steps and must be replaced before this path operates. See
[CI/CD](ci-cd.md#backend-deploys).

<a id="dev"></a> <a id="staging"></a>

## Production

Production infrastructure and promotion are deferred to plan 73. Before real learner data or a
production release, choose availability/recovery objectives, data retention, provider budgets,
release gates and capacity using testing evidence. Additional environments, managed databases,
replicas, CDN and uninterrupted deployment are not prerequisites for this testing phase.

## Configuration

### Current API readers

[`apps/api/src/common/config.ts`](../../apps/api/src/common/config.ts) is the runtime source of
truth. Entries in `.env.example` without a reader are reserved for future adapters.

| Variable                            | Current behavior                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`                          | `production` makes missing WASM fatal at startup; use it for the deployed image   |
| `PORT`                              | HTTP listener; defaults to 3000                                                   |
| `AI_PROVIDER`                       | Defaults to `stub`; only the stub is registered in the runtime                    |
| `TTS_PROVIDER`                      | Defaults to `stub`; ElevenLabs requires key, model and `TTS_VOICE_ES_ES`          |
| `TTS_API_KEY`                       | Required only in `elevenlabs` mode; never logged                                  |
| `TTS_MODEL`                         | Pinned model id; empty in stub mode                                               |
| `TTS_OUTPUT_FORMAT`                 | Defaults to `mp3_44100_128`; conversion to AAC is the authoring CLI's job         |
| `TTS_VOICE_ES_ES`                   | Required in ElevenLabs mode; never invent a production id in code                 |
| `TTS_VOICE_BG_BG`                   | Optional until that locale is rendered; never substituted for another locale      |
| `TTS_VOICE_RU_RU`                   | Optional until that locale is rendered                                            |
| `TTS_CACHE_DIR`                     | Process-local identity cache for `/tts/render`; defaults to os tmpdir             |
| `MUSIC_PROVIDER`                    | Defaults to `stub`; fixture music only. Live ElevenLabs Music stays behind Q-21   |
| `MUSIC_MONTHLY_BUDGET_USD_PER_USER` | Separate from `AI_MONTHLY_BUDGET_USD_PER_USER`; `0` means unlimited in stub       |
| `MUSIC_DAILY_BUDGET_USD_GLOBAL`     | Separate global music cap; `0` means unlimited in stub                            |
| `CDN_BASE_URL`                      | Legacy content manifest `audio_base`; no CDN or working audio download is implied |
| `npm_package_version`               | Version reported by health; defaults to `0.0.0` outside the package runner        |

### Testing configuration to implement

Plan 66 owns PostgreSQL, migration and logger configuration. Plan 67 owns signing keys and session
secrets. Plans 61/86 own AWS region, bucket and download configuration. Add validated readers and
update `.env.example` with each adapter; do not publish executable configuration for missing
services.

Use the AWS credential provider chain and temporary instance-role credentials. Local MinIO keys must
never become AWS credentials. Private S3 content needs an authorized download path; setting
`CDN_BASE_URL` to a private bucket URL does not provide one.

All `EXPO_PUBLIC_*` configuration is public. It can contain a testing hostname when the mobile
client lands, but never database, signing, AWS or provider secrets.

### Secrets

- Local: gitignored `.env` values based on the checked-in example; never commit plaintext secrets.
- CI: AWS OIDC with a role scoped to this repository and testing environment; no long-lived AWS key.
- EC2: standard SSM SecureString parameters, fetched into restricted runtime files. Terraform
  provisions permissions and references, not secret values. Never put values in state, user data,
  image layers, workflow output or logs.
- Bootstrap missing secrets idempotently. A redeploy must not rotate database passwords or signing
  keys accidentally. Document deliberate rotation and recovery when the consuming adapter lands.

## Data handling

Use synthetic data throughout this phase. Never import production learner databases into testing.
Restrict backups to deployment/operator roles and restore only into an isolated destination. Do not
log phrase text, tokens, transcripts or signed download URLs. Recorded learner audio remains on
device and is never accepted by the backend or uploaded to S3.
