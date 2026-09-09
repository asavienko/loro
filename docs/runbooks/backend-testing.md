# Backend testing operations

**Status: partial implementation; full operational acceptance remains open.** The existing
CloudFormation-managed EC2, private PostgreSQL, SOPS runtime files and HTTPS gateway are recorded in
[EC2 deployment](../process/ec2-deployment.md). This runbook specifies the remaining single-host
testing profile in [plan 88](../../plans/88-low-cost-backend-infrastructure.md). The local backup
collector below is implemented; off-host recovery, scheduling, retained storage and monitoring still
need implementation and live verification. Do not use local-development Compose against EC2 or treat
these checklists as completed checks.

## Before provisioning

Inventory the existing stacks before provisioning. Record the AWS account, Frankfurt region,
availability zone, gateway configuration, notification email and operator. Confirm the regional
estimate fits $25–35/month including EBS, IPv4, S3 and monitoring; no free-tier credit or paid
provider allowance is assumed. The AWS HTTPS hostname does not require a custom domain.

- Keep CloudFormation ownership until an explicit import/migration decision. Terraform, Caddy, SSM
  and a registry are earlier design candidates, not prerequisites or deployed facts.
- The current `t3.small` has one encrypted 30 GiB root disk. Standard CPU credits and a separate
  retained data volume remain to be reconciled with the existing stack; do not replace it blindly.
- Retain the HTTPS gateway and verified restricted SSH path. PostgreSQL and the API container port
  remain private; preserve the gateway's restricted proxy ingress.
- The data filesystem must mount before PostgreSQL starts; failure must not initialize a new DB.
- Retain SOPS-encrypted sources and restricted runtime files. Any SSM migration needs its own
  reviewed ownership and credential-access verification; require IMDSv2 on the host.
- Keep unfinished routes closed until persistence, auth and tenant-isolation tests pass.

Record current stack outputs and verified storage ownership before operational changes. Commands
must refer to actual checked-in scripts; placeholder commands are not evidence.

## Deploy an API release

The following is the remaining target sequence, not a description of every step in the current
candidate/cutover script. In particular, verified off-host pre-migration backup is still absent.

1. Select a commit with passing required local CI. Build WASM and the production image locally, scan
   and test that exact image, then transfer it with the existing SSH release tooling. GitHub Actions
   stays disabled; EC2 never builds images.
2. Acquire the deployment/backup lock. Check disk space, data mount, database health and the
   previous image's compatibility with the proposed migration.
3. Pull before downtime. Enable the proxy maintenance response and stop the API while retaining
   PostgreSQL and its volume. Do not use Compose volume teardown.
4. Complete a pre-migration backup and verify S3 upload/checksum. On failure, abort and reopen the
   unchanged healthy API; do not migrate without the backup.
5. Run migrations separately with the migration role. Use backward-compatible expansion; database
   major upgrades and destructive contract migrations require separate maintenance work.
6. Start the new API with its restricted role. Check internal `/v1/health/ready`, authenticated
   synthetic push/pull, tenant isolation and the content manifest before reopening traffic.
7. Reopen HTTPS, repeat the external smoke test and record image/schema/backup identifiers. On
   failure, return to maintenance and follow rollback.

Keep active and previous image digests plus three older successful releases. Registry and host
cleanup must exclude active/rollback images, mounted data, certificate state and pending backups.

## Recover a failed deployment

Restart the previous image only if it supports the current schema, then repeat readiness and smoke
checks. Otherwise stay in maintenance and report failure; never automatically downgrade the schema
or restore a backup over new writes.

Readiness depends on WASM, PostgreSQL and schema compatibility. Optional S3/provider outages should
report degraded capability without taking otherwise usable sync offline. `/v1/health` is liveness;
it does not establish persistence or authenticated access.

## Back up and restore

`scripts/ec2-backup.sh` collects a local recovery bundle on the existing host. After verifying host
identity and current stack outputs, an operator can run:

```bash
ssh ec2-user@EC2_PUBLIC_DNS 'sudo bash -s' < scripts/ec2-backup.sh
```

The collector shares `/var/lock/loro-api-deploy.lock` with release/database operations and fails
while that lock is held. It requires the existing `loro-api` and `loro-postgres` containers. It
creates a compressed custom-format dump, validates both its listing and all archive data, captures
the API/database image identities, schema and application-role attributes, and generates SHA-256
checksums. Only a complete verified directory is renamed from `.incomplete-*` to `backup-*` under
`/opt/loro/backups`; failed collections are removed. Files are root-only. The bundle's `RESTORE.txt`
describes isolated restoration, role/secret recovery and required acceptance checks. The schema file
is a separate capture under the host lock; all schema-changing operators must use that lock.

This command neither uploads nor schedules backups, changes release behavior, nor proves
restoration. It needs free disk for a full dump. A hard host/power failure can leave `.incomplete-*`
directories; inspect and remove those only while no operation holds the lock. Copy the whole
completed bundle to separately retained recovery storage and verify `SHA256SUMS` there before
treating it as an off-host recovery copy. Preserve the referenced images and encrypted secret
sources separately. No password or session/token value is printed, but database dumps contain
account data and require restricted recovery access. Existing pre-release dumps remain separate and
are not these bundles.

- Create nightly compressed custom-format PostgreSQL dumps and pre-migration dumps. Include
  role/grant recovery information and image/schema metadata. The API role is not a superuser.
- Serialize with deployments. Fail on dump/upload/checksum errors; mark success only after the
  complete backup is in S3. Delete completed local temporary dumps to protect disk space.
- Retain nightly backups for 14 days, pre-migration backups for seven days and bounded noncurrent
  versions. Expire abandoned multipart uploads. Preserve published content separately.
- Restore to an isolated database with required roles recreated. Stop on restore errors, verify
  records and privileges, and run authenticated smoke tests with the matching image.
- Verify restore before inviting testers and monthly afterwards. Record backup age, duration, checks
  and cleanup. Target roughly 24-hour recovery-point and two-hour recovery-time objectives; neither
  is proven until the drill passes. There is no point-in-time recovery.
- Prefer intact retained data when replacing a host in the same availability zone. If the volume/AZ
  is unavailable, rebuild and restore from S3. Never run two hosts against one writable database.

## Monitor and respond

Use CloudWatch, a small fixed metric set and SNS email. Collect host memory/disk explicitly; retain
redacted logs seven days and bound container logs. No tracing collector, warehouse, session replay
or mobile analytics SDK is required by this environment.

| Signal                   | Action threshold             | First response                                                          |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| EC2 status or heartbeat  | Failure or missing heartbeat | Inspect through AWS/SSM; preserve the data volume                       |
| API health               | Repeated failed probe        | Check process, mount, database and migration state                      |
| Memory                   | Above 85% for ten minutes    | Inspect limits/OOM events; no automatic resize                          |
| Disk                     | Above 80%                    | Inspect logs, temporary dumps and unused images; never prune DB volumes |
| CPU credits              | Depleted                     | Check sustained load/throttling before revising capacity/budget         |
| Latest successful backup | Older than 26 hours          | Repair backup path and verify a new upload                              |
| Monthly cost / forecast  | $25 and $35                  | Inspect resource/traffic costs; notifications are not a cap             |

Verify notification delivery and treat missing heartbeat data as failure. An offline learner device
is not a server alarm. Suspected corruption or tenant exposure requires closing the affected API
path and preserving evidence before recovery.

## Maintenance and shutdown

Review spend after the first week and before expanding testers. Run the plan-88 30-minute test with
ten concurrent synthetic accounts and 2,000-phrase libraries; record memory, errors and sync p95
against the existing ≤800 ms budget. Revise the budget before increasing instance size.

Apply host security updates in a maintenance window and verify reboot, mounts, TLS and smoke tests.
Pin images and review patch updates deliberately. The current gateway uses AWS-managed TLS; any
future local certificate/proxy migration must define persistence and renewal verification.

Stopping EC2 pauses compute charges but leaves EBS, S3 and the retained Elastic IP billable. Before
permanent teardown, verify a final backup and record retained resources. Release unneeded IPs and
DNS records explicitly. Destructive data cleanup is a separate deliberate action. The current base
CloudFormation stack deletes the instance disk and local database/backups; retained recovery assets
must be verified before teardown. Retained-volume protection is still outstanding.

Production capacity, uninterrupted deployment, managed failover and production retention remain
decisions for [plan 73](../../plans/73-delivery-observability-and-slos.md).
