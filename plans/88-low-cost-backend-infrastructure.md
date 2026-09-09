# Affordable AWS backend for testing

- **Requirement IDs:** `F-01`, `F-02`, `F-04`, `F-07`, `F-09`
- **Milestone:** M2 testing; production operations remain in plan 73.
- **Status:** 🟡 EC2/HTTPS, durable account/sync deployment, Google testing access and an isolated
  restore are recorded. A locally tested backup collector now validates complete archives and
  records image/schema/role recovery metadata under the deployment lock. Full consent-to-device
  proof, retained storage, scheduled off-host backups, load and operational acceptance remain.
  Reconcile infrastructure ownership with the deployed CloudFormation stacks before provisioning; do
  not rebuild the host or identity/sync runtime from the earlier proposal.
- **Depends on:** 66 exact API image and backend foundations; 67 shared access; 61/86 content
  adapters only when activated. Whole-plan completion is not an infrastructure prerequisite.
- **Reviewed:** 2026-09-09 against `aafa61f`; current source, tests and retained review records
  inspected. This plan refresh supplies no new runtime, device or deployment acceptance.
- **Priority:** 9; start recovery/operations acceptance alongside priority 1.

Previous starting point:
[archived snapshot](archive/2026-09-08/88-low-cost-backend-infrastructure.md).

## Documentation

[Backend architecture](../docs/architecture/backend.md#testing-infrastructure),
[environments](../docs/process/environments.md), [CI/CD](../docs/process/ci-cd.md#backend-deploys)
and the [testing runbook](../docs/runbooks/backend-testing.md) describe this selected profile. Plan
91 provides a CloudFormation-managed host with restricted administrative SSH and a guarded HTTPS
account gateway. The 2026-09-08 account-release record in `docs/process/ec2-deployment.md` reports
PostgreSQL/WASM readiness, Google start/cancellation, anonymous auth/sync rejection and an isolated
20-table restore. Live consent-to-device proof, scheduled off-host recovery and the full testing
profile remain outstanding. Reverify the deployed artifact and access policy before operational
changes; this review does not claim a fresh AWS probe.

## Outcome and scope

Provide one always-on testing environment in **Frankfurt (`eu-central-1`)**, targeting
**$25–35/month**. Complete infrastructure ownership, deployment configuration and the operations
runbook against the existing resources. The earlier Terraform migration proposal needs an explicit
import/ownership decision before execution. This plan owns the testing infrastructure; plan 73
retains production operations ownership.

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

## Existing deployment and remaining architecture decisions

Plans 91/92 record an Amazon Linux development host managed by CloudFormation, local image
build/transfer over restricted SSH, and an API Gateway/Lambda HTTPS preview. These are the starting
point. Source integration does not establish which runtime image or routes are deployed today.

Retain one Frankfurt EC2 instance, local PostgreSQL and private S3 within the selected budget.
Inventory stacks, storage, gateway policy, runtime configuration and immutable image identity before
changing them. Verify authenticated shared access with synthetic accounts before inviting testers.

The archived proposal selected Ubuntu, Caddy, separate data volumes, Terraform state, ECR and SSM.
These are migration/design candidates, not evidence of deployed resources or permission to replace
them. Decide reuse/import/migration explicitly, retaining the protection, recovery and acceptance
requirements below. GitHub Actions remains disabled; build, test and deploy locally using the
existing scripts. No managed staging stack, Redis, CDN or idle workers are required.

Use **standard CPU credits** for predictable compute cost and monitor credit depletion: sustained
CPU demand can be throttled. See
[AWS instance documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html).

Start with an API memory limit of 512 MiB, PostgreSQL at 640 MiB and a local proxy, if used, at 128
MiB, leaving room for the host and agents. Set the Node heap below its container limit. Start
PostgreSQL with 128 MiB shared buffers, 30 connections maximum and an API pool of five. Validate
these limits under load.

Cost controls:

- Budget approximately $18 for compute, $3–4 for disks, $3.65 for IPv4 and the remaining allowance
  for storage, registry and monitoring. This is a planning estimate; verify Frankfurt prices before
  provisioning.
- Assume light traffic, at most 10 GiB total S3 storage and 1 GiB/month of log ingestion. Exclude
  tax, domain registration, external CI charges and paid providers.
- Configure actual-spend and forecast notifications at $25 and $35. These notify; they do not cap
  spending.
- Keep AI stubbed and TTS disabled. Build images with local CI, never on EC2.
- Exclude RDS, NAT Gateway, load balancer, Kubernetes, CDN, Redis, workers, Spot instances and
  additional permanent environments. Revisit local Redis only when an implemented feature needs it.
- Document shutdown costs: stopped EC2 still incurs disk and retained public-IP charges.
  [AWS IPv4 pricing](https://aws.amazon.com/vpc/pricing/)

## Provisioning, configuration and storage

- [ ] Record ownership of the existing CloudFormation resources. Decide whether to retain them or
      import/migrate to Terraform without duplicate resources or destructive replacement. If
      Terraform is selected, use separate bootstrap/testing roots, versioned S3 state with native
      locking and pinned providers. Preserve the existing deployment until migration is verified.
- [ ] Keep infrastructure ownership separate from application releases. Changing an image must not
      replace EC2; deployment scripts remain local.
- [ ] Protect the state bucket, backups and data volume from routine destruction. Retain PostgreSQL
      data across instance replacement and explicitly pin its availability zone.
- [ ] If a separate retained data volume is selected, mount it by filesystem UUID before Compose
      starts. A missing mount must fail startup rather than silently create a fresh database on the
      root disk.
- [ ] Preserve restricted ingress and the existing HTTPS gateway unless a reviewed migration changes
      it. PostgreSQL must remain private. Require IMDSv2, scoped instance permissions and separate
      infrastructure/deployment IAM roles; verify SSH/proxy access against the runbook.
- [ ] Retain the current SOPS-to-restricted-runtime-file path until an SSM migration is recorded. If
      selected, use standard-tier SSM SecureString parameters. An idempotent bootstrap command
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

Required inputs include the AWS account and notification destination. Custom-domain/DNS inputs are
required only if a reviewed TLS migration needs them; the existing AWS HTTPS hostname does not.
Provisioning fails clearly when an input for the selected path is absent.

## Deployment and recovery

Use local deployment scripts for a committed artifact that passed local CI. GitHub Actions is
disabled; do not restore the historical automatic dev→staging chain or add an OIDC workflow.

- [ ] Build with the repository's pinned Node/pnpm versions and real Rust/WASM artifact. Test and
      scan the exact `linux/amd64` image, then transfer/deploy that same immutable artifact using
      the existing local release tooling. A registry/SSM migration requires a recorded ownership
      plan.
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

- Implemented preparation: `scripts/ec2-backup.sh` produces atomic, root-only local recovery bundles
  with archive validation, image/schema/role metadata and SHA-256 manifests. The offline
  `scripts/ec2-backup-verify.mjs` validates a copied bundle's required metadata, restrictive modes,
  checksums and active-database safeguard before an operator records a drill. Local command-fixture
  tests cover collector failure paths and verifier tamper/permission/manifest safeguards. These are
  local integrity checks, not PostgreSQL restore or AWS evidence. Scheduling, verified S3 upload and
  release integration remain unbuilt; no nightly/off-host acceptance box is closed by this tooling.
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

## Delivery order and gates

1. Inventory existing resource ownership, image/schema identity and gateway configuration before any
   migration. Reuse the recorded account deployment and restore procedure; refresh evidence against
   the candidate image rather than treating a dated successful probe as current acceptance.
2. Start alongside priority 1 with the existing backup collector: add verified private S3 upload,
   scheduled nightly/pre-migration runs, retention and backup-age alerts. Restore a retained
   off-host bundle into an isolated database and verify roles/grants, schema, synthetic accounts and
   tenant isolation against its recorded image. Retain upload/checksum and restore results together;
   command fixtures and the dated local restore do not prove this path. Keep existing SOPS,
   CloudFormation and local transfer paths unless a specific migration is justified and recorded.
   Coordinate deletion/recovery records with 67/68 before accepting backup restoration for
   lifecycle-enabled accounts.
3. Verify retained-storage/host-replacement recovery and alert delivery, then use synthetic accounts
   for service/load checks against 66's exact candidate image; add physical-device convergence after
   58/68. Supply private storage configuration to 61/86 independently of whole-plan completion. A
   missing device cannot be replaced by an infrastructure-only convergence claim.

## Monitoring and acceptance

- [ ] Use CloudWatch with a small fixed metric set, seven-day redacted log retention and SNS email
      notifications. Include host memory/disk collection explicitly; basic EC2 metrics are
      insufficient.
- [ ] Alert on instance failure, repeated API-health failure, memory above 85% for ten minutes, disk
      above 80%, depleted CPU credits and backup age exceeding 26 hours. Configure missing heartbeat
      data as a failure. Verify notification delivery.
- [ ] Validate the selected infrastructure owner and prove an idempotent second plan/change set with
      no unexpected replacement. If migrating to Terraform, verify import and state recovery.
- [ ] Verify valid TLS, blocked unauthorized SSH/database access and rejected unsigned S3 downloads.
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
