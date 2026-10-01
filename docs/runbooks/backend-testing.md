# EC2 backups and recovery

Operations for the development host in [ec2-deployment.md](../process/ec2-deployment.md). The local
backup collector and the offline verifier exist; off-host storage, scheduling, monitoring and a
tested restore do not.

## Take a backup

```bash
ssh ec2-user@HOST 'sudo bash -s' < scripts/ec2-backup.sh
```

It takes the deploy lock (`/var/lock/loro-api-deploy.lock`) and fails while a release holds it. It
writes a compressed custom-format dump (read back in full to prove it is whole), the API and
database image identities, the schema, the `loro` role's attributes, a `RESTORE.txt` and
`SHA256SUMS`, then renames the checked directory to `/opt/loro/backups/backup-<time>-<id>`. Files
are root-only; dumps contain account data. A crash can leave `.incomplete-*` directories: remove
them only while no operation holds the lock.

Every release also leaves `/opt/loro/backups/pre-release-<time>.dump`: a dump without the bundle's
metadata or checksums.

## Copy and verify off the host

A backup on the instance is lost with it. Copy the whole bundle to separately retained storage, then
verify it there:

```bash
ssh ec2-user@HOST 'sudo tar -C /opt/loro/backups -cf - backup-YYYYMMDDTHHMMSSZ-XXXXXXXX' |
  tar -xpf - -C /restricted/recovery
node scripts/ec2-backup-verify.mjs /restricted/recovery/backup-YYYYMMDDTHHMMSSZ-XXXXXXXX
```

The verifier checks that the directory and its files are private to their owner, that every required
file is present and non-empty, and that each matches `SHA256SUMS` (`tar -p` keeps the modes). A pass
proves the bundle's integrity, not that a restore works.

## Restore

Follow the bundle's `RESTORE.txt`: restore into an isolated PostgreSQL instance running the recorded
database image, recreate the `loro` role from the encrypted SOPS source, stop on any error, check
records and privileges, and run authenticated smoke tests against the recorded API image. Never
restore over a database that has newer writes.

## Recover a failed deploy

A release that fails its checks restores the previous container itself
([ec2-deployment.md](../process/ec2-deployment.md#deploy)). To go back further, release an older
image only if it supports the current schema, then repeat the readiness checks; otherwise leave the
API down and report it. `/v1/health` is liveness only; `/v1/health/ready` checks the content, the
WASM merge and PostgreSQL.

## Still missing

Nightly and pre-migration uploads to S3, retention, CloudWatch alarms (health, disk, memory, backup
age, cost), a timed restore drill, and a data volume that survives stack deletion.
