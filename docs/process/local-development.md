# Local development

Two ways to run the API and the app: on the host for fast reload, or as containers that need no host
Rust or PostgreSQL. Configuration variables are in [environments.md](environments.md).

## On the host

Use Node 22 (`nvm use 22`) and put cargo on the PATH (`export PATH="$HOME/.cargo/bin:$PATH"`).

```bash
pnpm install
pnpm core-rs:build                        # the API's WASM merge; again after Rust changes
pnpm --filter @loro/api dev:up            # PostgreSQL (plus Redis and MinIO) in Docker, on loopback
cp apps/api/.env.example apps/api/.env    # the API loads apps/api/.env itself
pnpm --filter @loro/api dev               # the API on :3000/v1, reloading on change
pnpm --filter @loro/mobile web            # the app in a browser on :8081 (Rust core as WASM)
pnpm --filter @loro/mobile android        # Android development build (needs cargo-ndk)
```

Without `pnpm core-rs:build` the API starts but `/v1/health/ready` reports `merge: unavailable`. The
app's own setup (the API URL, the emulator, iOS) is in
[`apps/mobile/README.md`](../../apps/mobile/README.md).

### Signing in locally

`.env.example` turns sign-in off (`AUTH_ENABLED=false`). For email codes with the API on the host,
remove that line and set a signing key (`AUTH_PRIVATE_KEY_PEM`, or `AUTH_SIGNING_KEY` of 32+ bytes),
`AUTH_EMAIL_HASH_KEY` (32+ characters), `AUTH_MAGIC_DELIVERY_URL=http://127.0.0.1:8787/send` and any
`AUTH_MAGIC_DELIVERY_TOKEN`. Then run the local receiver with the same token:

```bash
AUTH_MAGIC_DELIVERY_TOKEN=… node scripts/local-magic-delivery.mjs
```

It writes the latest code to `.tmp/loro-magic-delivery.json` and never logs it.

## Containers

The root Compose stack (`compose.yaml`) runs the API, PostgreSQL and the Expo web app, building the
Rust/WASM merge inside Docker. Install Docker (Compose 2.30+), SOPS and age
(`brew install sops age`), then:

```bash
pnpm local:up      # decrypt apps/api/.env, build, start and wait for health checks
pnpm local:logs
pnpm local:down    # keeps data; `docker compose down --volumes` deletes it
```

Open <http://localhost:8081>. <http://localhost:3000/v1/health/ready> reports `content`, `merge` and
`database` as `ok` when the stack is healthy. Source is copied into the image, so run
`pnpm local:up` again after changes; use the host commands for fast reload. Every port binds to
loopback.

The `infra` profile adds Redis and MinIO (`docker compose --profile infra up -d --wait`; credentials
in `apps/api/docker-compose.yml`). Nothing the app calls uses them.

## Encrypted environment (SOPS / age)

`secrets/api.enc.env` is the encrypted local API environment; `secrets/ec2-*.enc.env` are the
development host's ([ec2-deployment.md](ec2-deployment.md)). `.sops.yaml` holds only the public age
recipient. The private identity lives outside the repository at `~/.config/sops/age/loro.txt` (or
`SOPS_AGE_KEY_FILE`); back it up, since a lost key can't be recovered.

```bash
pnpm env:edit       # edit secrets/api.enc.env in $EDITOR
pnpm env:decrypt    # write apps/api/.env (mode 600, gitignored), replacing local edits
pnpm env:encrypt    # encrypt the current apps/api/.env into secrets/api.enc.env
```

To add a machine, add its public recipient to `.sops.yaml` and run
`sops updatekeys secrets/<file>.enc.env` for each file; commit both. Never commit a private key or a
plaintext `.env`.
