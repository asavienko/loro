# EC2 development host

The API runs on one restricted Amazon Linux 2023 EC2 instance (`infra/ec2/template.yaml`): a
t3.small with an encrypted 30 GiB disk, IMDSv2, Docker, and SSH from one IPv4 address. The API binds
to host loopback; admin access is an SSH tunnel. This is a development host, not production.

## Current instance

- AWS profile `loro` (SSO), region `eu-central-1`, stack `loro-api-dev`, instance
  `i-0ce58e049c8fe0f7b`, key pair `loro-ec2-dev` (private key at `~/.ssh/loro-ec2-dev`).
- The public DNS can change after stop/start; read the stack outputs before connecting. If your IP
  changes, re-run `scripts/provision-ec2.sh` with the new `ADMIN_CIDR`.
- Merging to `main` does not redeploy; the running image is whatever was last deployed.

## Provision

Needs AWS credentials with CloudFormation/EC2 access, an existing VPC with a public subnet, and a
key pair.

```bash
export AWS_REGION=eu-central-1 VPC_ID=vpc-… SUBNET_ID=subnet-… KEY_NAME=… ADMIN_CIDR=YOUR_IP/32
./scripts/provision-ec2.sh
```

Verify the host key through the AWS console, add it to `known_hosts` (deploys use strict host-key
checking) and set `IdentityFile` in `~/.ssh/config`.

## Database

`scripts/ec2-database.sh` creates a persistent `loro-postgres` volume on a private `loro-backend`
Docker network (no host port) with a non-superuser `loro` owner; it never resets an existing
database. Runtime config comes from `secrets/ec2-api.enc.env` and `secrets/ec2-postgres.enc.env`,
decrypted locally, copied over SSH to root-owned mode-600 files (`/opt/loro/runtime/api.env`,
`/opt/loro/database/postgres.env`), then removed locally.

## Deploy

Node 22, installed dependencies, cargo on PATH and Docker with amd64 builds:

```bash
pnpm check
bash scripts/deploy-ec2.sh HOST /opt/loro/runtime/api.env loro-backend
ssh -N -L 127.0.0.1:13000:127.0.0.1:3000 ec2-user@HOST
curl --fail http://127.0.0.1:13000/v1/health/ready
```

The script builds WASM and the linux/amd64 image locally (working-tree changes included), streams it
over SSH, takes a PostgreSQL dump, starts a candidate, swaps it in and re-checks readiness; a failed
check restores the previous container. Cutover has brief downtime. The previous container is kept as
`loro-api-previous`; roll back by redeploying its image tag:

```bash
ssh ec2-user@HOST 'sudo bash -s -- loro-api:PREVIOUS_TAG' < scripts/ec2-release.sh
ssh ec2-user@HOST 'sudo docker logs --tail 100 loro-api'
```

Migrations must stay backward compatible: rollback never restores an older database over new writes.

## Public HTTPS gateway

API Gateway → a VPC Lambda → nginx on the host port 8080 → the API on `127.0.0.1:3000`. The gateway
is the CloudFormation stack `loro-api-gateway` (`infra/ec2/https.yaml`, the Lambda's code inline,
tested from that source by `pnpm test:deploy`); nginx is installed by
`scripts/deploy-ec2-proxy.sh HOST readonly|accounts`. Only the Lambda's security group reaches
port 8080. Both layers allow explicit routes: health and the content endpoints always; with the
stack's `AccountAccess=enabled` and nginx in `accounts` mode also sign-in, `/me`, sync and **the
library** (`/v1/library/*`): every route the app calls, each with its own methods (reads also answer
`HEAD`; `OPTIONS` preflights reach the API's CORS). Any other path is
`404 {"error":"not_available"}` at the Lambda. Google sign-in is in testing mode (project
`loro-508020`); Apple is unconfigured; email codes go to a host-local inbox.

What passes through, on library routes:

- **Requests**: the bearer, `Content-Type`, `Range` and `If-None-Match`; the query keys `target`,
  `kind`, `q`, `sort`, `exp`, `sig` and `v`. Bodies up to 4 MiB (a learner's progress can reach 3.8
  MB; account routes keep 1 MiB). Cookies and caller forwarding headers never pass. The Lambda names
  the caller's address (`requestContext.http.sourceIp`) to nginx, which sends it to the API as
  `X-Real-IP`, replacing anything the caller sent.
- **Responses**: JSON and text as text; audio, covers and anything else base64-encoded, so song
  audio, ranges (`206`, `Content-Range`, `Accept-Ranges`) and clips arrive byte-exact. The API's
  `Cache-Control`, `ETag`, `Content-Security-Policy` and `Retry-After` pass through; a reply without
  a `Cache-Control` gets `no-store`. Lambda refuses replies over 6 MB, so one that would exceed it
  is `502 {"error":"response_too_large"}` rather than a cut-off body.
- **Rates**: the stage allows 50 requests/s with a burst of 100 (Explore loads a cover per set; the
  player checks a clip per phrase). nginx allows the library 50 r/s (burst 100) and account routes
  20 r/s (burst 40) per gateway address.
- **Time**: an HTTP API integration has at most **30 s**. The Lambda gives up on the API at 28 s
  (its own timeout is 29 s) and nginx at 28 s. Without `ANTHROPIC_API_KEY` every library route
  answers in well under a second. With live Claude on this host, phrase decks, notes and covers are
  written while the request waits (the writer allows itself 90 s): one that takes longer than 30 s
  reaches the app as a gateway `503` although the server finishes it and counts the allowance. Keep
  live Claude off this gateway until generation answers inside that ceiling or moves to a job the
  app polls, as songs already do.

Roll out a change to the gateway or nginx in this order: the API (above), then nginx, then the
stack. `aws cloudformation deploy` keeps every parameter it isn't given at the stack's current value
(`VpcId`, `SubnetId`, `PrivateIp`, `OriginSecurityGroup`):

```bash
bash scripts/deploy-ec2-proxy.sh HOST accounts
aws cloudformation deploy --profile loro --region eu-central-1 --stack-name loro-api-gateway \
  --template-file infra/ec2/https.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides AccountAccess=enabled
aws cloudformation describe-stacks --profile loro --region eu-central-1 \
  --stack-name loro-api-gateway --query 'Stacks[0].Outputs'
node scripts/check-account-api.mjs https://GATEWAY_HOST/v1
```

The proxy script validates the configuration under the container's restrictions, reloads nginx and
probes it from the host: health, denied paths, and in `accounts` mode the pack, a signed-out
`usage`, a clip's `HEAD`, a 3 MB body accepted and a 5 MB one refused. `AccountAccess=disabled`
withdraws sign-in, sync and the library from the gateway without touching data.

## Teardown

Deleting the stack destroys the instance, its disk, the database volume and local backups. Take and
verify an off-host backup first ([backend-testing.md](../runbooks/backend-testing.md)).
