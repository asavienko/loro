# Local development

## Host commands

Use Node 22 (`nvm use 22`) and put cargo on the PATH (`export PATH="$HOME/.cargo/bin:$PATH"`).

```bash
pnpm --filter @loro/mobile web        # the app in a browser (Rust core as WASM)
pnpm --filter @loro/mobile android    # Android development build (needs cargo-ndk)
pnpm --filter @loro/api dev           # the API on :3000; needs PostgreSQL and apps/api/.env
```

Expo Go can't run the app: it needs the `LoroCore` native module (a development build).

## Containers

The root Compose stack runs the API, PostgreSQL and the Expo web app, building the Rust/WASM merge
inside Docker; no host Rust or Postgres is needed. Install Docker (Compose 2.30+), SOPS and age
(`brew install sops age`), then:

```bash
pnpm local:up      # decrypt the API env, build, wait for health checks
pnpm local:logs
pnpm local:down    # keeps data; `docker compose down --volumes` deletes it
```

Open <http://localhost:8081>. <http://localhost:3000/v1/health/ready> must report the database and
merge engine available. Source is copied into the image, so run `pnpm local:up` again after changes;
use the host commands for fast reload. Ports bind to loopback.

Optional Redis and MinIO: `docker compose --profile infra up -d --wait` (Postgres 5432, Redis 6379,
MinIO 9000/9001; credentials in `apps/api/docker-compose.yml`).

## Encrypted environment (SOPS / age)

`secrets/api.enc.env` is the encrypted API environment; `.sops.yaml` holds only the public age
recipient. The private identity lives outside the repo at `~/.config/sops/age/loro.txt` (or
`SOPS_AGE_KEY_FILE`); back it up, since a lost key can't be recovered.

```bash
pnpm env:edit       # edit encrypted values in $EDITOR
pnpm env:decrypt    # write apps/api/.env (mode 0600, gitignored); replaces local edits
pnpm env:encrypt    # encrypt the current apps/api/.env
```

To add a machine, add its public recipient to `.sops.yaml` and run
`sops updatekeys secrets/api.enc.env`; commit both. Never commit a private key or plaintext `.env`.
Without `ANTHROPIC_API_KEY` or a music provider, the API uses labelled fallbacks (see
[environments.md](environments.md)).
