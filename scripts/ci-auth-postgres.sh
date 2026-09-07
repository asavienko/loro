#!/usr/bin/env bash
# A disposable local database: auth tests drop their tables, so never use a developer DB.
set -euo pipefail
cd "$(dirname "$0")/.."
container=''
cleanup() {
  if [[ -n "$container" ]]; then docker rm -f "$container" >/dev/null; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
container=$(docker run --detach --rm \
  -e POSTGRES_PASSWORD=loro-test-only -e POSTGRES_DB=loro_auth_test \
  -p 127.0.0.1::5432 postgres:16-alpine)
ready=false
for ((attempt=0; attempt<30; attempt++)); do
  if docker exec "$container" pg_isready -U postgres -d loro_auth_test >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container"
  echo 'Local auth PostgreSQL did not become ready.' >&2
  exit 1
fi
address=$(docker port "$container" 5432/tcp)
port=${address##*:}
AUTH_TEST_DATABASE_URL="postgres://postgres:loro-test-only@127.0.0.1:$port/loro_auth_test" \
  pnpm --filter @loro/api exec vitest run src/auth/auth.test.ts
