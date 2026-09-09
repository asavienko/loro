> Historical snapshot archived on 2026-09-08 (F-04). Its starting point is superseded; unfinished
> work remains in [active plan 88](../2026-09-09/88-low-cost-backend-infrastructure.md). This is not
> a completion record.

# Affordable AWS backend for testing

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, `F-09`
- **Milestone:** M2 testing; production operations remain in plan 73.
- **Status:** — Planned; infrastructure preparation can start now. Shared access requires the
  persistence/security slice of 66 and authentication/tenant isolation from 67; mobile sync testing
  additionally requires the relevant device and convergence slices of 59/68. The restricted EC2
  deployment in [plan 91](91-ec2-backend-deployment.md) is live; this plan still owns PostgreSQL,
  S3, TLS, Terraform and shared testing readiness.
- **Depends on:** 66 exact API image and backend foundations; 67 shared access; 61/86 content
  adapters only when activated. Whole-plan completion is not an infrastructure prerequisite.
- **Reviewed:** 2026-09-07; user selected Frankfurt, a small tester group and a $25–35 monthly
  budget.

## Documentation

[Backend architecture](../../../docs/architecture/backend.md#testing-infrastructure),
[environments](../../../docs/process/environments.md),
[CI/CD](../../../docs/process/ci-cd.md#backend-deploys) and the
[testing runbook](../../../docs/runbooks/backend-testing.md) describe this selected profile.
Documentation is complete. Plan 91 provides a CloudFormation-provisioned SSH-only development API;
the broader testing stack, runtime wiring and operational evidence remain outstanding.

## Outcome and scope

Provide one always-on testing environment in **Frankfurt (`eu-central-1`)**, targeting
**$25–35/month**. Deliver Terraform, deployment configuration and an operations runbook. This plan
owns the testing infrastructure; plan 73 retains production operations ownership.

Keep one instance, with PostgreSQL on that instance and S3 for durable object storage and backups.
Use synthetic test data, accept brief maintenance downtime and one failure domain, and make no
production availability guarantee.

Readiness stages:

1. **Infrastructure:** verify EC2, PostgreSQL, S3, TLS and recovery using synthetic fixtures. Keep
   unfinished API routes inaccessible externally.
2. **Shared backend testing:** require the relevant plan-66 persistence/security work and plan-67
   authentication and tenant isolation.
3. **Mobile sync testing:** additionally require the relevant device-persistence and convergence
   work from plans 59/68. Completing all of plan 68 is not an infrastructure prerequisite.

## Architecture and operating budget

```text
Tester devices -- HTTPS --> EC2
                            |-- Caddy
                            |-- NestJS API
                            `-- PostgreSQL 16 --> S3 backups

API -- authorized downloads --> private S3 content
GitHub Actions -- OIDC / SSM --> deployment
```

| Component      | Selected configuration                                               |
| -------------- | -------------------------------------------------------------------- |
| Compute        | One On-Demand `t3.small`, x86-64, 2 vCPU / 2 GiB RAM                 |
| Host           | Ubuntu 24.04 LTS; Docker Compose managed by systemd                  |
| Disk           | Encrypted gp3: 16 GiB root and separate 20 GiB data volume           |
| Network        | One VPC, public subnet, internet gateway and Elastic IP              |
| TLS            | Caddy with automatic certificate renewal; existing-domain subdomain  |
| Storage        | Separate private S3 buckets for content, backups and Terraform state |
| Administration | AWS Systems Manager; no inbound SSH                                  |
| Registry       | Private ECR; immutable release images                                |

Use **standard CPU credits** for predictable compute cost and monitor credit depletion: sustained
CPU demand can be throttled. See
[AWS instance documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html).

Start with an API memory limit of 512 MiB, PostgreSQL at 640 MiB and Caddy at 128 MiB, leaving room
for the host and agents. Set the Node heap below its container limit. Start PostgreSQL with 128 MiB
shared buffers, 30 connections maximum and an API pool of five. Validate these limits under load.

Cost controls:

- Budget approximately $18 for compute, $3–4 for disks, $3.65 for IPv4 and the remaining allowance
  for storage, registry and monitoring. This is a planning estimate; verify Frankfurt prices before
  provisioning.
- Assume light traffic, at most 10 GiB total S3 storage and 1 GiB/month of log ingestion. Exclude
  tax, domain registration, external CI charges and paid providers.
- Configure actual-spend and forecast notifications at $25 and $35. These notify; they do not cap
  spending.
- Keep AI stubbed and TTS disabled. Build images in CI, never on EC2.
- Exclude RDS, NAT Gateway, load balancer, Kubernetes, CDN, Redis, workers, Spot instances and
  additional permanent environments. Revisit local Redis only when an implemented feature needs it.
- Document shutdown costs: stopped EC2 still incurs disk and retained public-IP charges.
  [AWS IPv4 pricing](https://aws.amazon.com/vpc/pricing/)

## Provisioning, configuration and storage

- [ ] Put Terraform under `infra/terraform/`, with separate bootstrap and testing roots. Bootstrap
      the state bucket, then migrate bootstrap state into it. Enable versioning and native S3
      locking; no DynamoDB lock table. Pin Terraform/provider versions and commit the provider
      lockfile.
      [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [ ] Keep infrastructure ownership in Terraform and application releases in deployment scripts.
      Changing an image must not replace EC2.
- [ ] Protect the state bucket, backups and data volume from routine destruction. Retain PostgreSQL
      data across instance replacement and explicitly pin its availability zone.
- [ ] Mount the data volume by filesystem UUID before Compose starts. A missing mount must fail
      startup rather than silently create a fresh database on the root disk.
- [ ] Expose only ports 80/443. PostgreSQL has no published host port. Require IMDSv2, scoped
      instance permissions and separate infrastructure/deployment IAM roles.
- [ ] Store secrets in standard-tier SSM SecureString parameters. An idempotent bootstrap command
      creates missing values without printing them; Terraform never reads their values. Fetch
      secrets into restricted runtime files and verify container access to temporary AWS
      credentials.
- [ ] Use separate PostgreSQL application and migration roles; the API never connects as superuser.
- [ ] Enable S3 public-access blocking, encryption and TLS-only policies. Add the free S3 gateway
      endpoint. Do not restrict content downloads exclusively to that endpoint, because tester
      devices access S3 externally.
      [AWS gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html)
- [ ] Supply buckets and IAM/configuration to plans 61/86, which own content adapters and
      authenticated URL issuance. This plan introduces no new learner-facing API routes.
- [ ] Preserve published immutable content. Apply bounded backup/version retention and remove
      abandoned multipart uploads. Recorded learner audio never enters S3.
- [x] Document the testing exception to managed dependencies and blue-green deployment in the
      backend/environment guides, and align plans 73/86 with this ownership when implementation
      starts.

Required deployment inputs: AWS account, existing-domain hostname/DNS access and notification email.
Provisioning fails clearly when these are absent.

## Deployment and recovery

Use one GitHub `testing` environment with manual deployment of a commit that has passed required CI.
Remove the current automatic dev→staging deployment chain from the testing path.

- [ ] Build with the repository's pinned Node/pnpm versions and real Rust/WASM artifact. Test and
      scan the exact `linux/amd64` image, then deploy its digest through OIDC and SSM.
- [ ] Pin database/proxy images too. Keep database major upgrades separate from application deploys.
- [ ] Serialize deployments and backups with a host lock.
- [ ] Deploy in this order: pull image → enable maintenance response → stop API → complete and
      verify backup upload → run compatible migrations → start API → verify readiness and
      authenticated smoke tests → reopen traffic.
- [ ] Require readiness to check WASM, PostgreSQL and schema compatibility. Do not make optional
      S3/provider outages fail otherwise usable sync readiness.
- [ ] On failure, restart the previous image only when its schema compatibility is established.
      Otherwise retain maintenance mode and report failure. Never automatically restore the database
      or reverse migrations.
- [ ] Protect the active and previous image digests from cleanup; retain three additional successful
      releases. Bound container log files.

Backups and recovery:

- [ ] Run nightly compressed custom-format PostgreSQL dumps and pre-migration dumps. Include
      role/grant recovery instructions and image/schema metadata; a database dump alone does not
      recreate cluster roles.
      [PostgreSQL backup documentation](https://www.postgresql.org/docs/16/backup-dump.html)
- [ ] Fail on any dump/upload error. Record success only after verifying the uploaded object and
      checksum.
- [ ] Retain nightly backups for 14 days and migration backups for seven days, with bounded
      noncurrent-version retention.
- [ ] Target recovery from the last successful nightly backup within two hours. This permits
      approximately one day of lost server data; point-in-time recovery is excluded.
- [ ] Verify restoration before inviting testers and repeat monthly in an isolated environment.
- [ ] Document host replacement, reattaching retained storage, full restore from S3, secret
      recovery, certificate renewal, security updates and teardown.

## Monitoring and acceptance

- [ ] Use CloudWatch with a small fixed metric set, seven-day redacted log retention and SNS email
      notifications. Include host memory/disk collection explicitly; basic EC2 metrics are
      insufficient.
- [ ] Alert on instance failure, repeated API-health failure, memory above 85% for ten minutes, disk
      above 80%, depleted CPU credits and backup age exceeding 26 hours. Configure missing heartbeat
      data as a failure. Verify notification delivery.
- [ ] Pass Terraform validation, safe second-plan output and no unexpected replacement.
- [ ] Verify valid TLS, blocked SSH/database access and rejected unsigned S3 downloads.
- [ ] Verify database survival across API restart, reboot and instance replacement.
- [ ] Reject cross-user reads/writes using two authenticated synthetic accounts.
- [ ] Pass S3 adapter smoke tests when that adapter lands.
- [ ] Prove failed-deploy recovery and a fresh-database restore with verified permissions and
      records.
- [ ] Exercise ten concurrent synthetic users with 2,000-phrase libraries for 30 minutes: no OOM,
      corruption or unexpected errors, with sync p95 meeting the existing ≤800 ms target.
- [ ] Run `pnpm check`, relevant API/PostgreSQL integration tests and exact-image tests. Browser E2E
      changes are needed only if learner-visible behavior changes.
- [ ] Review the first week's cost before expanding the tester group.

If measured memory or CPU pressure exceeds this setup, revise the budget before resizing.
Infrastructure tests and restore evidence establish only the completed stage; do not report missing
auth, mobile sync, content delivery or production availability as implemented.
