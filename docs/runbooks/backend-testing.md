# EC2 backups and recovery

Operations for the development host in [ec2-deployment.md](../process/ec2-deployment.md). The local
backup collector and the offline verifier exist; off-host storage, scheduling, monitoring and a
tested restore do not.

## Take a backup

```bash
ssh ec2-user@HOST 'sudo bash -s' < scripts/ec2-backup.sh
```

It shares the deploy lock (`/var/lock/loro-api-deploy.lock`) and fails while a release holds it. It
writes a compressed custom-format dump, the API/database image identities, schema and role
attributes, SHA-256 checksums and a `RESTORE.txt`, then renames the verified directory to
`/opt/loro/backups/backup-*`. Files are root-only; dumps contain account data. A crash can leave
`.incomplete-*` directories: remove them only while no operation holds the lock.

This is not off-host recovery. Copy the whole bundle to separately retained storage, then verify it
there:

```bash
node scripts/ec2-backup-verify.mjs /restricted/recovery/backup-YYYYMMDDTHHMMSSZ-XXXXXXXX
```

A pass proves the bundle's integrity only, not that a restore works.

## Restore

Restore into an isolated database with the roles recreated, stop on any error, check records and
privileges, and run authenticated smoke tests against the matching image. Never restore over a
database that has newer writes.

## Recover a failed deploy

Redeploy the previous image only if it supports the current schema, then repeat readiness checks.
Otherwise leave the API down and report it. `/v1/health` is liveness only; `/v1/health/ready` checks
PostgreSQL and WASM.

## Still missing

Nightly and pre-migration uploads to S3, retention, CloudWatch alarms (health, disk, memory, backup
age, cost), a timed restore drill, and a retained data volume that survives stack deletion.
