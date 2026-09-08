#!/usr/bin/env bash
# Runs as root on EC2; also accepts a previous local image tag for manual rollback.
set -euo pipefail
[[ ( $# == 1 || $# == 3 ) && $1 =~ ^loro-api:[a-zA-Z0-9_.-]+$ ]] || exit 2
runtime=()
if [[ $# == 3 ]]; then
  [[ $2 == /opt/loro/*.env && -f $2 && ! -L $2 && $3 =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || exit 2
  [[ $(stat -c '%u:%a' "$2") == 0:600 ]] || { echo 'Runtime environment must be root-owned mode 600' >&2; exit 1; }
  docker network inspect "$3" >/dev/null
  runtime=(--env-file "$2" --network "$3")
fi
image=$1
exec 9>/var/lock/loro-api-deploy.lock
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
docker image inspect "$image" >/dev/null
if [[ ${#runtime[@]} -gt 0 ]]; then
  # Candidate startup runs additive migrations. Keep a pre-migration recovery artifact.
  umask 077
  mkdir -p /opt/loro/backups
  backup="/opt/loro/backups/pre-release-$(date -u +%Y%m%d%H%M%S).dump"
  docker exec loro-postgres pg_dump -U postgres -d loro -Fc > "$backup"
  [[ -s $backup ]] || { echo 'Pre-migration backup failed' >&2; exit 1; }
fi
ready() {
  local name=$1
  for ((i=0; i<30; i++)); do
    if docker exec "$name" /nodejs/bin/node -e \
      "fetch('http://127.0.0.1:3000/v1/health/ready',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      return 0
    fi
    sleep 2
  done
  return 1
}
run() {
  docker run -d --name "$1" --restart unless-stopped --read-only \
    --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 \
    --memory 768m --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --log-opt max-size=10m --log-opt max-file=3 \
    "${runtime[@]}" -e NODE_ENV=production -e AI_PROVIDER=stub "${@:2}" "$image"
}
# Candidate is never published. A failed candidate cannot stop the current service.
docker rm -f loro-api-candidate >/dev/null 2>&1 || true
trap 'docker rm -f loro-api-candidate >/dev/null 2>&1 || true' EXIT
run loro-api-candidate
ready loro-api-candidate || { echo 'Candidate readiness failed; current service retained' >&2; exit 1; }
docker rm -f loro-api-candidate >/dev/null
had_previous=false
if docker container inspect loro-api >/dev/null 2>&1; then
  docker rm -f loro-api-previous >/dev/null 2>&1 || true
  docker stop loro-api >/dev/null
  docker rename loro-api loro-api-previous
  had_previous=true
fi
rollback() {
  docker rm -f loro-api >/dev/null 2>&1 || true
  if $had_previous; then
    docker rename loro-api-previous loro-api
    docker start loro-api >/dev/null
    ready loro-api || { echo 'Rollback readiness failed' >&2; return 1; }
  fi
}
if ! run loro-api -p 127.0.0.1:3000:3000 || ! ready loro-api; then
  rollback
  echo 'Deployment failed; previous container restored if present' >&2
  exit 1
fi
echo "Deployed $image; readiness passed. API: 127.0.0.1:3000 (SSH tunnel)."
