#!/usr/bin/env bash
# F-01/F-04: run on EC2 as root. Reuses the database volume; never resets data.
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 2
exec 9>/var/lock/loro-api-deploy.lock
flock -n 9
umask 077
mkdir -p /opt/loro/database /opt/loro/backups
# The operator supplies an encrypted-at-rest source and installs only a mode-600 runtime copy.
config=/opt/loro/database/postgres.env
[[ -f $config && ! -L $config && $(stat -c '%u:%a' "$config") == 0:600 ]] || {
  echo 'Install root-owned /opt/loro/database/postgres.env with mode 600 first.' >&2; exit 1;
}
docker network inspect loro-backend >/dev/null 2>&1 || docker network create loro-backend >/dev/null
docker volume inspect loro-postgres >/dev/null 2>&1 || docker volume create loro-postgres >/dev/null
if ! docker container inspect loro-postgres >/dev/null 2>&1; then
  docker run -d --name loro-postgres --restart unless-stopped --network loro-backend \
    --env-file "$config" --mount type=volume,source=loro-postgres,target=/var/lib/postgresql/data \
    --memory 512m --cpus .5 --pids-limit 128 \
    --log-opt max-size=10m --log-opt max-file=3 postgres:16-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685 >/dev/null
else
  docker start loro-postgres >/dev/null
fi
for attempt in {1..30}; do
  if docker exec loro-postgres pg_isready -h 127.0.0.1 -U postgres >/dev/null; then
    docker exec -i loro-postgres sh -c 'psql -U postgres -v ON_ERROR_STOP=1 -v password="$LORO_DB_PASSWORD"' <<'SQL'
SELECT format('CREATE ROLE loro LOGIN PASSWORD %L', :'password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loro') \gexec
SELECT 'CREATE DATABASE loro OWNER loro'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'loro') \gexec
SQL
    echo 'PostgreSQL is ready on the private Docker network; no host port is published.'
    exit 0
  fi
  sleep 1
done
echo 'PostgreSQL readiness failed' >&2
exit 1
