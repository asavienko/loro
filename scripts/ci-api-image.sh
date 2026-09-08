#!/usr/bin/env bash
# F-03: exercise the deployed dependency tree, not workspace node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
image=${1:-loro-api:local-check}
if [[ $# == 0 ]]; then
  docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$image" .
fi
name="loro-image-check-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --platform linux/amd64 --name "$name" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --memory 768m --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m -e NODE_ENV=production -e AI_PROVIDER=stub "$image" >/dev/null
for attempt in {1..30}; do
  if docker exec "$name" /nodejs/bin/node -e '
    fetch("http://127.0.0.1:3000/v1/health/ready",{signal:AbortSignal.timeout(1000)})
      .then(async r=>{const b=await r.json();process.exit(r.ok && b.status==="ok" && b.checks?.merge==="ok" ? 0 : 1)})
      .catch(()=>process.exit(1))' >/dev/null 2>&1; then
    docker exec "$name" /nodejs/bin/node -e '
      (async()=>{
        const base="http://127.0.0.1:3000/v1";
        const providers=await fetch(base+"/auth/providers");
        if(!providers.ok || (await providers.json()).providers.length!==0) throw Error("provider discovery");
        const content=await fetch(base+"/content/v2/manifest?native=bg&target=ru-RU");
        const body=await content.json();
        if(!content.ok || body.nativeLanguage!=="bg" || body.targetLocale!=="ru-RU" || body.phraseCount!==31) throw Error("multilingual content");
      })().catch(e=>{console.error(e);process.exit(1)})'
    echo 'Exact API image passed readiness, disabled-provider discovery and multilingual content.'
    exit 0
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$name") == true ]] || break
  sleep 1
done
docker logs --tail 30 "$name"
echo 'API image failed readiness' >&2
exit 1
