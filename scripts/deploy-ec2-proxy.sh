#!/usr/bin/env bash
# F-01/F-03: explicit public routes; API remains on host loopback.
set -euo pipefail
[[ $# -ge 1 && $# -le 2 && $1 =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
mode=${2:-readonly}
[[ $mode == readonly || $mode == accounts ]] || exit 2
config=infra/ec2/public-proxy.conf
[[ $mode != accounts ]] || config=infra/ec2/account-proxy.conf
cd "$(dirname "$0")/.."
opts=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
scp "${opts[@]}" "$config" "ec2-user@$1:/tmp/loro-public-proxy.conf"
scp "${opts[@]}" infra/ec2/account-upstream.conf "ec2-user@$1:/tmp/loro-account-upstream.conf"
ssh "${opts[@]}" "ec2-user@$1" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
exec 9>/var/lock/loro-proxy-deploy.lock
flock -n 9
image=nginx@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c
docker pull "$image"
docker run --rm --user 101:101 --read-only --cap-drop ALL --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --entrypoint nginx -v /tmp/loro-public-proxy.conf:/etc/nginx/nginx.conf:ro \
  -v /tmp/loro-account-upstream.conf:/etc/nginx/account-upstream.conf:ro "$image" -t
mkdir -p /opt/loro/proxy
cp /tmp/loro-account-upstream.conf /opt/loro/proxy/account-upstream.conf
cp /tmp/loro-public-proxy.conf /opt/loro/proxy/nginx.conf
if docker container inspect loro-public-proxy >/dev/null 2>&1; then
  # Mount the directory so an atomic config replacement is visible to reloads.
  docker exec loro-public-proxy nginx -s reload
else
  docker run -d --name loro-public-proxy --restart unless-stopped --network host --user 101:101 \
    --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 \
    --memory 64m --cpus .25 --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    --log-opt max-size=5m --log-opt max-file=2 \
    -v /opt/loro/proxy:/etc/nginx:ro --entrypoint nginx "$image" -g 'daemon off;'
fi
for attempt in {1..10}; do
  if curl -fsS http://127.0.0.1:8080/v1/health/ready; then break; fi
  sleep 1
done
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/v1/health/ready) == 200 ]]
for path in /v1/sync/pull /v1/ai/scene /v1/health/ready/extra; do
  [[ $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8080$path") == 404 ]]
done
[[ $(curl -s -X POST -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/v1/health/ready) == 405 ]]
echo 'Proxy health and deny probes passed; verify account flows before enabling gateway AccountAccess.'
REMOTE
