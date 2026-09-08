# Local containers and encrypted environment

The root Compose stack runs the current API, PostgreSQL and Expo web app. It builds the Rust/WASM
merge inside Docker; no host Rust, Postgres or provider account is needed. Browser practice uses
durable local SQLite snapshots; account and sync rows live in PostgreSQL. Provider/email sign-in
requires the separately configured credentials in [persistent practice](persistent-practice.md).
Containers serve the browser and API; native speech requires an installed device build.

## Start and stop

Install Docker Desktop (or another Docker Engine with Compose 2.30+), SOPS and age. On macOS:

```bash
brew install sops age
```

With Docker running, use Node 22 and the repository's pnpm:

```bash
nvm use 22
pnpm local:up
```

This decrypts the API environment, builds the image and waits for the database, API and web health
checks. The initial build downloads Node/Rust dependencies and takes several minutes. Open
<http://localhost:8081>; API readiness is <http://localhost:3000/v1/health/ready> and must report
both database and merge engine available.

```bash
pnpm local:logs
pnpm local:down
```

Source is copied into the image. Run `pnpm local:up` again after code changes. For fast reload, use
the existing host development commands instead. This stack serves the browser; it does not run an
iOS simulator or Android emulator. Ports bind to loopback.

Optional Redis and MinIO infrastructure for future content/provider integrations:

```bash
docker compose --profile infra up -d --wait
# Stop optional infrastructure too; named data volumes are retained.
docker compose --profile infra down
```

Postgres is on 5432, Redis on 6379, MinIO on 9000 and its console on 9001. Their local credentials
remain in `apps/api/docker-compose.yml`. PostgreSQL starts with the default stack and stores durable
auth/sync data; Redis and MinIO remain optional. Do not run the legacy infrastructure stack at the
same time: the ports overlap. `down --volumes` deletes data; ordinary `local:down` retains it.

## SOPS / age

`secrets/api.enc.env` is the versionable encrypted API environment. `.sops.yaml` contains only the
age public recipient. This machine's private identity is outside the repository at
`~/.config/sops/age/loro.txt`, with owner-only permissions. Back it up securely: the public
recipient cannot recover a lost private key. For another key location, set `SOPS_AGE_KEY_FILE`.

```bash
# Edit encrypted values in your configured $EDITOR, then refresh the local plaintext.
pnpm env:edit
pnpm env:decrypt
# Or edit apps/api/.env locally and encrypt its current contents:
pnpm env:encrypt
```

Decryption atomically replaces `apps/api/.env`, so encrypt any local edits first. Commands never
print decrypted values. Plaintext is gitignored, mode 0600, and excluded from Docker build context;
it remains on disk for Compose until you remove it. The API receives it at runtime. Docker users can
inspect container environment values; SOPS protects the repository copy, not a running host. Avoid
displaying `docker compose config` without `--quiet` when secrets are present.

On another machine, restore your private identity securely or have an existing key holder add a new
age public recipient to `.sops.yaml` and run:

```bash
SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/loro.txt" sops updatekeys secrets/api.enc.env
```

Commit both the recipient change and the updated ciphertext. Never commit the private key. The
encrypted starter contains development defaults and empty provider keys; AI remains stubbed. Public
mobile URLs are declared separately in Compose: no provider credentials reach the web app.

References: [SOPS age configuration](https://getsops.io/docs/) and
[Compose environment files](https://docs.docker.com/reference/compose-file/services/#env_file).
