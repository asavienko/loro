#!/usr/bin/env bash
# The landing page (F-09): the stack, then the folder as it is, zipped, as one Amplify deployment.
# Idempotent; a run with nothing changed changes nothing but the deployment number.
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION}"
cd "$(dirname "$0")/.."
for tool in aws curl jq zip pnpm; do command -v "$tool" >/dev/null; done
[[ $(node -p 'process.versions.node.split(".")[0]') == 22 ]] || { echo 'Use Node 22' >&2; exit 1; }
stack=${STACK_NAME:-loro-landing}
pnpm --filter @loro/landing lint
pnpm --filter @loro/landing typecheck
pnpm --filter @loro/landing test
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name "$stack" --template-file infra/landing/template.yaml \
  --no-fail-on-empty-changeset ${NO_EXECUTE:+--no-execute-changeset}
output() {
  aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
app=$(output AppId)
url=$(output Url)
[[ $app =~ ^[a-z0-9]+$ ]] || { echo "No stack outputs: $app" >&2; exit 1; }
# What the browser needs and nothing else: not the README, the test, the local server or the
# package files. The archive's root is the site's root.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/site/src"
cp apps/landing/index.html "$work/site/"
cp apps/landing/src/*.css apps/landing/src/*.js apps/landing/src/*.svg "$work/site/src/"
rm -f "$work/site/src/"*.test.js
(cd "$work/site" && zip -qr ../site.zip .)
deployment=$(aws amplify create-deployment --region "$AWS_REGION" --app-id "$app" --branch-name main --output json)
job=$(jq -r .jobId <<< "$deployment")
curl --fail --silent --show-error --output /dev/null --upload-file "$work/site.zip" "$(jq -r .zipUploadUrl <<< "$deployment")"
aws amplify start-deployment --region "$AWS_REGION" --app-id "$app" --branch-name main --job-id "$job" \
  --query jobSummary.status --output text
# Amplify has no waiter for a job; a deployment of this size takes well under a minute.
for _ in $(seq 1 60); do
  status=$(aws amplify get-job --region "$AWS_REGION" --app-id "$app" --branch-name main --job-id "$job" \
    --query job.summary.status --output text)
  case $status in
    SUCCEED) echo "Loro's landing page: $url"; exit 0 ;;
    FAILED | CANCELLED) echo "Deployment $job $status" >&2; exit 1 ;;
  esac
  sleep 5
done
echo "Deployment $job still $status after five minutes" >&2
exit 1
