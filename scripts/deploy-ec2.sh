#!/usr/bin/env bash
# M0 delivery: build locally, transfer over verified SSH, health-gate replacement.
set -euo pipefail
if [[ ( $# != 1 && $# != 3 ) || ! $1 =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]; then
  echo 'Usage: scripts/deploy-ec2.sh HOST [REMOTE_ENV_FILE DOCKER_NETWORK]' >&2
  exit 2
fi
host=$1
runtime=''
if [[ $# == 3 ]]; then
  [[ $2 =~ ^/opt/loro/[a-zA-Z0-9/_.-]+\.env$ && $3 =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || exit 2
  runtime=" $2 $3"
fi
cd "$(dirname "$0")/.."
for tool in docker pnpm ssh gzip; do command -v "$tool" >/dev/null; done
[[ $(node -p 'process.versions.node.split(".")[0]') == 22 ]] || { echo 'Use Node 22' >&2; exit 1; }
ssh_opts=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
ssh "${ssh_opts[@]}" "ec2-user@$host" 'sudo cloud-init status --wait >/dev/null && sudo docker info >/dev/null'
pnpm --filter @loro/core-rs build:wasm
pnpm --filter @loro/api build
image="loro-api:$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)"
docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$image" .
bash scripts/ci-api-image.sh "$image"
docker save "$image" | gzip | ssh "${ssh_opts[@]}" "ec2-user@$host" 'gunzip | sudo docker load'
# shellcheck disable=SC2029 # Locally generated image tag is intentionally passed to remote bash.
ssh "${ssh_opts[@]}" "ec2-user@$host" "sudo bash -s -- '$image'$runtime" < scripts/ec2-release.sh
