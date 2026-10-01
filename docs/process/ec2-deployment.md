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

API Gateway → a VPC Lambda → nginx on the host (`infra/ec2/https.yaml`, installed by
`scripts/deploy-ec2-proxy.sh HOST readonly|accounts`). It allows an explicit list of routes: health,
the content endpoints, and (in `accounts` mode) sign-in, `/me` and sync. The `/v1/library/*` routes
the current app uses are **not** on that list yet. Google sign-in is in testing mode (project
`loro-508020`); Apple is unconfigured; email codes go to a host-local inbox.

## Teardown

Deleting the stack destroys the instance, its disk, the database volume and local backups. Take and
verify an off-host backup first ([backend-testing.md](../runbooks/backend-testing.md)).
