# Docker and Docker Compose: fix the image build, then make the stack runnable

- **Requirement IDs:** the M0 deliverable "NestJS API skeleton … deployed to `dev`, reachable from a
  device"; supports `F-04`, `AI-01`…`AI-05`
- **Milestone:** M1
- **Size:** M
- **Spec:** `docs/process/environments.md`, `docs/process/ci-cd.md`,
  `docs/architecture/security-privacy.md#server-hardening`
- **Depends on:** nothing to start; §3 and §7 want
  [api-postgres-persistence.md](13-api-postgres-persistence.md)

## Current state, verified

There is more Docker here than the repo lets on, and one piece of it cannot work.

**What exists and is good.** `apps/api/Dockerfile` is a three-stage build — pnpm deps, esbuild
bundle, then `gcr.io/distroless/nodejs22-debian12` running as `nonroot` with a `HEALTHCHECK` against
`/v1/health`. `apps/api/docker-compose.yml` brings up Postgres 16, Redis 7, and MinIO with an init
container that creates the `loro-content` bucket, each with a real healthcheck and a named volume.
`apps/api/.env.example` documents every variable with local defaults that match the compose
services. `apps/api/package.json` wires `dev:up` / `dev:down`. `docs/process/environments.md`
describes the four-environment promotion path and states the design goal plainly: **local works
offline, needs no API keys, costs nothing.**

That is a well-thought-out setup. The problems are in the seams.

### 1. The image build cannot succeed — the deploy workflow has never worked

`apps/api/Dockerfile` build stage:

```dockerfile
# The WASM build of loro-core: the server runs the SAME merge as the client.
# Built in CI and copied in, so this image needs no Rust toolchain.
COPY packages/core-rs/pkg packages/core-rs/pkg
```

But `packages/core-rs/pkg/` is **gitignored** (`.gitignore:15`, confirmed with `git check-ignore`)
and has **zero tracked files**. Meanwhile `.github/workflows/api-deploy.yml` builds the image from a
bare checkout:

```yaml
- uses: actions/checkout@v4
- uses: docker/build-push-action@v6
  with:
    context: .
    file: apps/api/Dockerfile
```

No `pnpm core-rs:build`, and no download of the `core-rs-artifacts` artifact that `ci.yml` uploads
for exactly this purpose. So `COPY` has no source path and the build fails before it reaches the
bundle step. The comment is accurate about the _intent_ — "built in CI and copied in" — and the CI
that builds it is a different workflow that never hands it over.

Note the deliberate asymmetry this sits inside: `packages/core-rs/bindings/` **is** committed and
drift-checked because "native targets need it without the JS toolchain" (`.gitignore`, ADR-0014),
while `pkg/` is not. So the fix belongs in the workflow, not in `.gitignore` — committing a WASM
binary would undo a decision that was made on purpose.

This also explains why nobody has noticed: compose has no API service, so `docker build` is not part
of anyone's local loop.

### 2. There is no `.dockerignore` anywhere in the repo

`context: .` therefore uploads the whole repo to the build daemon: `node_modules/` across five
workspaces, `.git/`, `.turbo/cache/` (24 `.tar.zst` archives), `apps/mobile/.expo-export/` (a Hermes
bundle plus 24 asset blobs), and the 3 629-line blueprint with its screenshots.

Two costs, one of which matters more than build time: **`.env` is not excluded**. It is gitignored,
so it is absent in CI — but a developer running `docker build` locally ships their real
`ANTHROPIC_API_KEY`, `JWT_PRIVATE_KEY`, and `REFRESH_TOKEN_PEPPER` into the build context. Nothing
in the Dockerfile `COPY`s it today, which is luck rather than design; `COPY apps/api apps/api` would
pick it up the moment the build stage changes.

### 3. Compose starts three services that no code uses

`apps/api/src/` contains no reference to `postgres`, `drizzle`, `ioredis`, `redis`, `bullmq`, or S3
— the dependencies are declared in `package.json` and unused. The sync store is a module-level `Map`
(`apps/api/src/sync/sync.controller.ts`), and `CLAUDE.md` is right that you should "skip `dev:up`
unless you're building the repository layer."

So compose is correct-but-premature. Keep it, and make its state legible rather than surprising:
`dev:up` currently starts three containers, consumes a gigabyte, and changes nothing about how the
API behaves.

### 4. Nothing pins, so nothing reproduces

`minio/minio:latest` and `minio/mc:latest` are floating tags — the local stack changes underneath
the team without a commit. `postgres:16-alpine`, `redis:7-alpine`, and `node:22-alpine` are better
but still mutable. And the deploy references the image by tag (`loro-api:${GITHUB_SHA::12}`) rather
than by digest, so what gets deployed is not provably what was built.

### 5. Compose binds to every interface with the password `loro`

`ports: ['5432:5432']` binds `0.0.0.0`. On a café or hotel network — which this team will be on,
given the product — that is an open Postgres with credentials `loro:loro` and a MinIO with
`loro-dev-secret`. One character fixes it: `127.0.0.1:5432:5432`.

### 6. Supply chain is a `TODO`

`api-deploy.yml` has `run: echo "TODO(M0) — secret scan of the image, not just the source"`. No
vulnerability scan, no SBOM, no provenance, no signing. `docs/architecture/security-privacy.md`
describes server hardening the image partly implements (distroless, non-root) and the pipeline does
not verify.

---

## The work

### 1. Fix the image build — decide where the WASM comes from

Two defensible options; pick one and record it in `docs/process/ci-cd.md`.

**(a) Hand the artifact over (recommended).** `api-deploy.yml` builds `core-rs` — or downloads the
artifact `ci.yml` already uploads — before `docker build`. Cheapest, keeps the image free of a Rust
toolchain, and matches the Dockerfile's stated intent.

```yaml
- uses: dtolnay/rust-toolchain@stable
  with: { targets: wasm32-unknown-unknown }
- uses: Swatinem/rust-cache@v2
  with: { workspaces: packages/core-rs }
- run: pnpm core-rs:build
```

**(b) Build the WASM inside the image**, as a fourth stage from a Rust base. Self-contained and
reproducible from a clean checkout with nothing but Docker — which is a real virtue for a local
`docker build` — at the cost of a much slower build and a second place the Rust toolchain is pinned.

Whichever is chosen, **make the failure loud and specific**. A `COPY` of a missing directory
produces an opaque buildkit error. Add a guard stage that checks for `loro_core_bg.wasm` and fails
with the actual instruction (`run pnpm core-rs:build first`) — the same courtesy
`apps/api/src/main.ts` already extends at runtime, and `apps/api/src/sync/merge.ts` at import time.

This matters more than a broken workflow usually would: `main.ts` refuses to boot in production
without the merge, on the grounds that "serving sync with a half-built image is worse than not
serving it." The image build is the first line of that same defence.

### 2. Add `.dockerignore`

At the repo root, since that is the build context. Exclude `node_modules`, `.git`, `.turbo`,
`**/dist`, `**/.expo*`, `**/coverage`, `packages/core-rs/target`, `Language Learning by Phrases/`,
and — explicitly, first — `**/.env` and `**/.env.*` with `!**/.env.example`.

Then add a test: `docker build` with a deliberately planted `apps/api/.env` and assert the file is
absent from the resulting image (`docker run --rm --entrypoint /nodejs/bin/node img -e "…"` or
`docker save` + inspect layers). An ignore file nobody verifies is one `COPY` away from being wrong.

### 3. Compose profiles: `deps`, `full`, `test`

One file, three ways to use it, so the current default (API on the host for fast reload) stays the
default while the Dockerfile becomes something people actually run.

- **`deps`** (default) — Postgres, Redis, MinIO. Exactly today's behaviour; `dev:up` unchanged.
- **`full`** — adds the API built from `apps/api/Dockerfile`, so `docker compose --profile full up`
  exercises the image locally. This is the change that would have caught §1 on day one. Needs
  `build: { context: ../.., dockerfile: apps/api/Dockerfile }` and the internal hostnames
  (`postgres`, `redis`, `minio`) rather than `localhost`, which means `.env.example` needs a second
  block or the compose file needs explicit `environment:` overrides. Prefer the overrides — one
  `.env.example` is easier to keep honest, and `environments.md` already says configuration is
  environment variables with no environment-specific code branches.
- **`test`** — ephemeral Postgres on a random port with `tmpfs` storage, for the repository contract
  suite in §7.

Add `depends_on: { postgres: { condition: service_healthy } }` for the API service — the
healthchecks exist and nothing waits on them.

### 4. Pin and bind

- Digest-pin every base image, including `node:22-alpine` and the distroless runtime. Dependabot is
  already configured (`.github/dependabot.yml`); add the `docker` ecosystem so pins get bumped by PR
  rather than by drift.
- Replace `minio/minio:latest` and `minio/mc:latest` with a pinned release.
- Bind every published port to `127.0.0.1`.
- Deploy by **digest**, not tag: have the build job output the digest and pass that through
  `_deploy.yml`, so a mutable tag cannot change what is running.

### 5. Multi-arch, or an explicit decision not to

`build-push-action` with no `platforms:` builds only the runner's architecture — `linux/amd64`. That
is probably right for the deploy target and wrong for the team: a developer on an Apple Silicon Mac
running the `full` profile gets a QEMU-emulated image that is slow enough to be misleading when
measuring anything.

Either add `platforms: linux/amd64,linux/arm64` (roughly doubles build time, and is required anyway
if the target is Graviton), or build amd64 for deploy and let local builds be native. Write the
choice down; do not leave it to whoever is debugging a slow container.

### 6. Supply chain — replace the `TODO`

- Vulnerability scan (Trivy or Grype) on the built image, failing on fixable high/critical, with a
  documented exception path.
- Secret scan of the image, which is what the `TODO` actually asks for.
- SBOM (`docker/build-push-action` emits one) attached to the release.
- Provenance and signing (cosign), verified at deploy.
- Keep the scan on the **image**, not just the source — a base-image CVE is invisible to
  `pnpm audit` ([security-hardening-api.md](39-security-hardening-api.md) covers the source side).

### 7. Testcontainers for the repository contract suite

[api-postgres-persistence.md](13-api-postgres-persistence.md) specifies one contract suite run
against both the in-memory and the Postgres repository — "that is what keeps the dev fallback
trustworthy." The `test` profile or Testcontainers is how that runs in CI without a hand-managed
database. Keep it in its own job so the fast suite stays fast.

### 8. Developer ergonomics

- `db:migrate`, `db:seed`, and a `db:reset` that drops the volume — the first two are promised by
  `docs/process/onboarding.md` §3 and defined nowhere
  ([docs-drift-cleanup.md](44-docs-drift-cleanup.md)).
- `dev:down` should keep volumes (it does); document `dev:nuke` for `down -v` explicitly, because
  guessing wrong destroys the seeded database.
- The LAN case is already documented in `environments.md`
  (`EXPO_PUBLIC_API_URL=http://192.168.1.42:3000`) — with the `full` profile the API must still bind
  `0.0.0.0` **inside** the container while the published port stays on the host's LAN interface.
  Those are different bindings and it is worth one sentence in `apps/api/README.md`.
- State in `apps/api/README.md` and `CLAUDE.md` what `dev:up` currently does and does not buy you,
  so nobody spends an afternoon wondering why an empty Postgres changed nothing.

### 9. Runtime hardening the Dockerfile implies but compose does not apply

The Dockerfile's header comment promises "read-only filesystem at runtime" and nothing enforces it.
Add to the `full` profile and to the deploy manifests: `read_only: true`, a `tmpfs` for anything
that needs to write, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, memory and CPU
limits, and log rotation. Then verify the container still starts — a read-only rootfs is exactly the
kind of claim that is false the first time it is tested.

### 10. Verify `pnpm deploy --prod` against `node-linker=hoisted`

`.npmrc` sets `node-linker=hoisted` deliberately, with a long comment explaining that Metro cannot
resolve through pnpm's isolated layout. The Dockerfile's
`pnpm --filter @loro/api deploy --prod /out` interacts with that setting and with workspace-package
injection, and its behaviour differs across pnpm 9/10. Since §1 means this line has likely never
executed in CI, confirm it produces a `/out` containing `dist/main.js`, the pruned production
`node_modules`, and the `@loro/core-rs` WASM that `merge.ts` loads — then assert it, by running
`/v1/health/ready` against the built image in CI.

CI already does this for the host build ("The built API must serve, not just compile",
`.github/workflows/ci.yml`). Do the same for the image; readiness returns 503 when the WASM is
missing, which makes it the exact check that would have caught §1.

---

## Acceptance criteria

- `docker build -f apps/api/Dockerfile .` succeeds from a clean clone, following one documented
  prerequisite command — and fails with an actionable message if that command was skipped.
- `api-deploy.yml`'s image job succeeds, and a CI step runs the built image and gets **200** from
  `/v1/health/ready` (not just `/health`).
- `.dockerignore` exists; a test proves a planted `.env` is not in the image.
- `docker compose up -d` starts today's three services and nothing else;
  `docker compose --profile full up` runs the API from the image against them, waiting on
  healthchecks.
- Every image is digest-pinned; Dependabot covers the `docker` ecosystem.
- No published port binds beyond `127.0.0.1`.
- The deploy references an image digest, not a tag.
- The multi-arch decision is recorded, and local builds on Apple Silicon are not silently emulated.
- Image vulnerability and secret scans run and can fail the build; an SBOM is produced; the
  `TODO(M0)` line is gone.
- The repository contract suite runs against a containerised Postgres in CI.
- `db:migrate`, `db:seed`, and `db:reset` exist and are what `onboarding.md` says they are.
- The container runs read-only with dropped capabilities and resource limits, verified by starting
  it.
- `apps/api/README.md` and `CLAUDE.md` describe what the local stack actually provides.

## Tests

- **Build from a clean tree** in CI (a fresh clone, not the incremental workspace) — this is the
  test that catches §1 and it is the single most valuable item here.
- Run the image and assert `/v1/health/ready` is 200 with the WASM present and 503 without it.
- The planted-`.env` exclusion test.
- Compose: `--profile full` up, wait for healthy, hit the API, tear down.
- Read-only rootfs smoke test.
- Digest-pin drift check — regenerating pins produces no diff.

## Risks

- **Option (b) in §1 slows every build.** Option (a) keeps builds fast but means the image is only
  reproducible with the artifact in hand. If reproducing a production image from a git SHA alone
  ever becomes a requirement (an incident, an audit), (b) is the one that satisfies it. Decide with
  that in mind rather than on build time alone.
- **Compose drifting from the deploy target.** Compose is not the production runtime, and a local
  stack that diverges teaches the wrong lessons. Keep the _image_ identical and let only the
  orchestration differ — `environments.md`'s "no environment-specific code branches, ever" is the
  rule to hold here too.
- **Premature containerisation of the API for local dev.** `dev` deliberately runs the API on the
  host for fast reload, and that is right. The `full` profile is for exercising the image, not for
  daily work; say so in the README or it will become the default and slow everyone down.

## Out of scope

- **The mobile app.** Expo builds need Xcode and the Android SDK; iOS builds require macOS and
  cannot be containerised. See
  [native-toolchain-and-dev-client.md](09-native-toolchain-and-dev-client.md).
- **A containerised Rust/WASM builder for local use.** Genuinely tempting — it would remove
  `~/.cargo` from onboarding — but it conflicts with `packages/core-rs/bindings/` being committed
  and drift-checked, and with the Criterion benches needing native performance. Worth its own
  decision, not a side effect of this plan.
- **Kubernetes manifests, Terraform, and the cloud runtime** — `ops`-side, and `_deploy.yml`'s
  `TODO(M0)`s are tracked in [ci-cd-and-release.md](16-ci-cd-and-release.md).
