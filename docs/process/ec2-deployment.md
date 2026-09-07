# EC2 development backend

The existing Nest API can run on one Amazon Linux 2023 x86 EC2 instance using
`infra/ec2/template.yaml`. This is a restricted development deployment: sync has no auth or tenant
isolation and all data disappears when its process restarts. Durable production service remains with
plans 66–68 and 73. Deployment and rollback both lose in-memory writes. Do not use learner data.

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
region. This destroys the instance and its disk. No database or backup is provisioned.

The template follows AWS's
[instance metadata options](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-instance-metadataoptions.html).

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
