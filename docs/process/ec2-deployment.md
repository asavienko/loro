# EC2 development backend

The Nest API can run on one Amazon Linux 2023 x86 EC2 instance using `infra/ec2/template.yaml`. This
is a restricted development deployment. Its current account profile uses persistent PostgreSQL and
authenticated tenant-scoped sync. The [public gateway](public-api.md) enables Google testing
sign-in. Earlier content-only releases are retained below as dated evidence. Production operations
and full device acceptance remain separate gates.

The template creates a t3.small with an encrypted 30 GiB gp3 disk, IMDSv2 required, Docker enabled
at boot, and SSH ingress from one IPv4 address. It opens no HTTP port. The API binds only to host
loopback; access is encrypted through SSH. The public subnet must have an Internet Gateway route and
belong to the specified VPC. EC2, disk and public IPv4 incur AWS charges.

## Provision

Prerequisites: AWS CLI credentials with CloudFormation/EC2 access and permission to read the public
AMI SSM parameter; an existing VPC/public subnet and EC2 key pair in the chosen region.

```bash
export AWS_REGION=eu-central-1
export VPC_ID=vpc-REPLACE SUBNET_ID=subnet-REPLACE KEY_NAME=REPLACE
export ADMIN_CIDR=YOUR_PUBLIC_IPV4/32
./scripts/provision-ec2.sh
```

The script prints the instance ID and public DNS host. Configure `IdentityFile` for that host in
`~/.ssh/config`. Verify the instance SSH host key through a trusted AWS console channel, then add it
to known_hosts with an interactive SSH connection. Deployment requires strict host-key checking. The
script waits for cloud-init; CloudFormation completion alone does not prove Docker is ready. Live
deployment and manual rollback were verified on 2026-09-07; see the instance details below.

## Deploy and access

Use Node 22 (`nvm use 22`), installed workspace dependencies (`pnpm install --frozen-lockfile`),
Rust/wasm-pack (`export PATH="$HOME/.cargo/bin:$PATH"`) and a running Docker daemon with amd64 build
support. Run the repository gate before deploying:

```bash
pnpm check
./scripts/deploy-ec2.sh EC2_PUBLIC_DNS
ssh -N -L 3000:127.0.0.1:3000 ec2-user@EC2_PUBLIC_DNS
# In another terminal:
curl --fail http://127.0.0.1:3000/v1/health/ready
```

Deployment builds WASM, bundles the API and builds the existing Dockerfile for linux/amd64, then
streams the image over SSH without a registry or cloud credentials on the instance. A timestamped
commit tag identifies the image (local working-tree changes are included). The release script locks
concurrent cutovers, checks an unpublished candidate, retains the previous container, replaces the
service and checks readiness again. Cutover has brief downtime; this is not blue-green routing.
Failed final readiness restores the previous container. A host crash during cutover may require
manual recovery. Container logs rotate and resource limits constrain the API. Restart policy
restores the active container after reboot; Docker health status alone does not auto-restart it.

## Operations

```bash
ssh ec2-user@EC2_PUBLIC_DNS 'sudo docker logs --tail 100 loro-api'
ssh ec2-user@EC2_PUBLIC_DNS 'sudo docker inspect loro-api-previous --format "{{.Config.Image}}"'
# Deploy a retained image through the same health gate:
ssh ec2-user@EC2_PUBLIC_DNS 'sudo bash -s -- loro-api:PREVIOUS_TAG' < scripts/ec2-release.sh
```

Check disk space periodically. Old images remain available for rollback; remove only explicitly
selected unused image tags after the rollback window. Do not prune containers during a deployment.
To remove this development environment, delete the named CloudFormation stack in the selected
region. This destroys the instance and its disk, including account-profile database volumes and
local backups. Retain and verify a separate recovery copy first.

The template follows AWS's
[instance metadata options](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-instance-metadataoptions.html).

The historical 2026-09-07 image below predates main's optional Google/Apple account support. The
original deployment did not provision provider credentials or PostgreSQL. The optional durable
account profile below now supplies them. Merging repository changes does not replace the running EC2
image.

## Verified development instance — 2026-09-07

- AWS profile: `loro` (SSO); region: `eu-central-1`.
- CloudFormation stack: `loro-api-dev`; instance: `i-0ce58e049c8fe0f7b`.
- Host: `ec2-3-70-202-73.eu-central-1.compute.amazonaws.com`.
- EC2 key pair: `loro-ec2-dev`; private key stays locally at `~/.ssh/loro-ec2-dev`.
- Host-specific SSH configuration and a verified known_hosts entry are installed locally.
- Image: `loro-api:67741e690fce-20260907131530`.

```bash
ssh -N -L 127.0.0.1:13000:127.0.0.1:3000 ec2-user@ec2-3-70-202-73.eu-central-1.compute.amazonaws.com
# Another terminal:
curl --fail http://127.0.0.1:13000/v1/health/ready
```

The public IP/DNS can change after stop/start; retrieve current stack outputs before connecting. SSH
ingress is restricted to the provisioning machine's public IPv4 /32. If it changes, update the
stack's AdminCidr using the provisioning script with the same region/network/key parameters. The key
pair was imported separately and is not deleted with the stack. The verification tunnel was closed
after testing; use the command above to open one when needed.

## Earlier content-only release — 2026-09-08

Image `loro-api:26dc09e2a27a-20260908114912` is healthy. It includes provider discovery and the
multilingual content API; provider credentials and PostgreSQL remain unconfigured. The standalone
APK can use the [read-only HTTPS gateway](public-api.md). See the
[readiness review](../reviews/2026-09-08-readiness.md) for verified capabilities and missing
essentials. The public gateway does not expose the legacy sync or AI routes.

## Durable account release (F-01/F-04)

The account profile uses `scripts/ec2-database.sh` on the existing host. It creates a persistent
`loro-postgres` Docker volume and private `loro-backend` network, exposes no PostgreSQL host port,
and creates a non-superuser `loro` database owner. It never resets an existing database. The host's
encrypted EBS disk holds the volume; instance deletion still requires a separately retained backup.

Encrypted configuration sources are `secrets/ec2-api.enc.env` and `secrets/ec2-postgres.enc.env`.
Decrypt only into ignored local files, transfer over verified SSH, install root-owned mode-600
runtime copies at `/opt/loro/runtime/api.env` and `/opt/loro/database/postgres.env`, and remove the
transfer copies. The API uses the Docker database hostname, not localhost. Never print
configuration.

```bash
bash scripts/deploy-ec2.sh HOST /opt/loro/runtime/api.env loro-backend
```

The configured release takes a custom-format PostgreSQL backup before candidate startup/migrations,
then uses the same environment/network for candidate and active containers. A failed backup or
candidate leaves the current API running. Container rollback retains the previous container's own
configuration and never restores an older database over new writes. Migrations must remain backward
compatible. Local pre-release dumps under `/opt/loro/backups` are not off-host disaster recovery;
scheduled backups, retained storage, monitoring and the full plan-88 operational profile remain
open.

Google development setup uses project `loro-508020`, a Web application OAuth client and the exact
public `/v1/auth/google/callback` URL. The app callback allowlist currently contains
`loro://account`. Web preview origins require an explicit HTTPS callback entry before use. Google
remains in testing mode. Apple and email delivery are unconfigured.

## Verified account release — 2026-09-08

- API image: `loro-api:0efdb14f2a20-20260908201218`.
- Google project: `loro-508020`; owner test account registered. Apple/email remain unavailable.
- Local `pnpm check` and all 171 API tests against isolated PostgreSQL passed. The exact amd64 image
  passed durable readiness, guarded sync, multilingual content and degraded content-only checks.
- Candidate and active API readiness passed with real PostgreSQL and WASM. An isolated restore of a
  post-migration dump reproduced all 20 tables; the API database role is not a superuser.
- nginx account profile and CloudFormation `AccountAccess=enabled` deployed. The HTTPS probe passed
  Google start/cancellation handoff, healthy database/core and anonymous account/sync rejection.
- Complete live consent/ticket/session verification is pending the device test: the in-app browser
  blocked the AWS hostname. This is not a confirmed end-to-end Google sign-in result.

Disable gateway account access before manually rolling back to a pre-authentication API image.
Current rollback containers retain their own configuration; never expose legacy sync publicly.
