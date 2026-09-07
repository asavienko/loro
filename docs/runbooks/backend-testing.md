# Backend testing operations

**Status: planned, not an operating deployment.** This runbook specifies the single-EC2 environment
selected in [plan 88](../../plans/88-low-cost-backend-infrastructure.md). Terraform, deployed
Compose, migrations, monitoring and these procedures still need implementation and verification. Do
not use local-development Compose against EC2 or treat the checklists here as completed checks.

## Before provisioning

Record the AWS account, Frankfurt region, availability zone, existing-domain hostname, notification
email and operator. Confirm the regional estimate fits $25–35/month including EBS, IPv4, S3, ECR and
monitoring; no free-tier credit or paid provider allowance is assumed.

- Use separate Terraform bootstrap/testing roots, protected S3 state and native state locking.
- One On-Demand `t3.small` uses standard CPU credits. Encrypted gp3 volumes hold 16 GiB root and 20
  GiB persistent data; retain the data volume during instance replacement.
- Caddy is the public entry point. Keep SSH, PostgreSQL and the API container port closed
  externally. Use Systems Manager for authenticated operator access.
- The data filesystem must mount before PostgreSQL starts; failure must not initialize a new DB.
- Create secrets only when absent and fetch from SSM at runtime. Verify the API container obtains
  the intended temporary credentials with IMDSv2 enabled.
- Keep unfinished routes closed until persistence, auth and tenant-isolation tests pass.

Add Terraform outputs, deployment manifest location and verified commands here when implementation
lands. Commands must refer to actual checked-in scripts; placeholder commands are not evidence.

## Deploy an API release

1. Select a commit with passing required CI. Build WASM and the production image in CI, scan and
   test the exact image, then select its immutable digest. EC2 only pulls images.
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

Apply host security updates in a maintenance window and verify reboot, mounts, certificates and
smoke tests. Pin images and review patch updates deliberately. Preserve Caddy certificate state
across restarts and verify renewal instead of repeatedly issuing certificates during tests.

Stopping EC2 pauses compute charges but leaves EBS, S3 and the retained Elastic IP billable. Before
permanent teardown, verify a final backup and record retained resources. Release unneeded IPs and
DNS records explicitly. Destructive data cleanup is a separate deliberate action; routine Terraform
destroy must not silently remove recovery assets or state.

Production capacity, uninterrupted deployment, managed failover and production retention remain
decisions for [plan 73](../../plans/73-delivery-observability-and-slos.md).
