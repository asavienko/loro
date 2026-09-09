#!/usr/bin/env bash
# F-03/F-04: exercise the deployed image with an isolated durable database.
set -euo pipefail
cd "$(dirname "$0")/.."
image=${1:-loro-api:local-check}
if [[ $# == 0 ]]; then
  docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$image" .
fi
# The local CI parent supplies a run-specific prefix so it can remove these resources if SIGKILL
# bypasses this script's EXIT trap. Direct invocations retain the PID-based default.
name="${LORO_API_IMAGE_CHECK_PREFIX:-loro-image-check-$$}"
network="$name-network"
database="$name-database"
content="$name-content"
cleanup() {
  docker rm -f "$name" "$database" "$content" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker network create --internal "$network" >/dev/null
docker run -d --rm --network "$network" --name "$database" \
  -e POSTGRES_PASSWORD=loro-test-only -e POSTGRES_DB=loro_image_test postgres:16-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$database" pg_isready -h 127.0.0.1 -U postgres -d loro_image_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$database" pg_isready -h 127.0.0.1 -U postgres -d loro_image_test >/dev/null
docker run -d --platform linux/amd64 --name "$name" --network "$network" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --memory 768m --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m -e NODE_ENV=production -e AI_PROVIDER=stub -e AUTH_ENABLED=false \
  -e DATABASE_URL="postgresql://postgres:loro-test-only@$database:5432/loro_image_test" "$image" >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$name" /nodejs/bin/node -e '
    fetch("http://127.0.0.1:3000/v1/health/ready",{signal:AbortSignal.timeout(1000)})
      .then(async r=>{const b=await r.json();process.exit(r.ok && b.status==="ok" && b.checks?.merge==="ok" && b.checks?.database==="ok" ? 0 : 1)})
      .catch(()=>process.exit(1))' >/dev/null 2>&1; then
    ready=true
    break
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$name") == true ]] || break
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs --tail 30 "$name"
  echo 'API image failed durable readiness' >&2
  exit 1
fi
docker exec "$name" /nodejs/bin/node -e '
  (async()=>{
    const base="http://127.0.0.1:3000/v1";
    const providers=await fetch(base+"/auth/providers");
    if(!providers.ok || (await providers.json()).providers.length!==0) throw Error("provider discovery");
    const content=await fetch(base+"/content/v2/manifest?native=bg&target=ru-RU");
    const body=await content.json();
    if(!content.ok || body.nativeLanguage!=="bg" || body.targetLocale!=="ru-RU" || body.phraseCount!==31) throw Error("multilingual content");
    const sync=await fetch(base+"/sync/pull",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({since:null,limit:10})});
    if(sync.status!==401 && sync.status!==503) throw Error("anonymous sync exposed");
  })().catch(e=>{console.error(e);process.exit(1)})'
# Existing content-only deployments may boot without PostgreSQL; they must report degraded readiness.
docker run -d --platform linux/amd64 --name "$content" --network "$network" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --memory 768m --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m -e NODE_ENV=production -e AI_PROVIDER=stub -e AUTH_ENABLED=false "$image" >/dev/null
for attempt in {1..30}; do
  if docker exec "$content" /nodejs/bin/node -e '
    (async()=>{
      const base="http://127.0.0.1:3000/v1";
      const health=await fetch(base+"/health"); if(!health.ok) throw Error("liveness");
      const ready=await fetch(base+"/health/ready"); const body=await ready.json();
      if(ready.status!==503 || body.status!=="degraded" || body.checks?.database!=="unavailable") throw Error("false readiness");
    })().catch(()=>process.exit(1))' >/dev/null 2>&1; then
    echo 'Exact API image passed durable readiness, guarded sync, multilingual content and degraded content-only readiness.'
    exit 0
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$content") == true ]] || break
  sleep 1
done
docker logs --tail 30 "$content"
echo 'Content-only API image failed its degraded-readiness contract' >&2
exit 1
