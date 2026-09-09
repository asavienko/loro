#!/usr/bin/env bash
# F-01/F-04: collect a verified local recovery bundle on the existing EC2 host.
# This does not upload, schedule, prune or restore backups.
set -euo pipefail
[[ $# == 0 && $(id -u) == 0 ]] || { echo 'Run as root without arguments.' >&2; exit 2; }
exec 9>/var/lock/loro-api-deploy.lock
flock -n 9 || { echo 'A deployment or database operation is running.' >&2; exit 1; }
umask 077
mkdir -p /opt/loro/backups
pending=$(mktemp -d /opt/loro/backups/.incomplete-XXXXXXXX)
trap 'rm -rf -- "$pending"' EXIT

# Image identity and schema are required recovery inputs, not optional annotations.
docker inspect --format '{{.Image}} {{.Config.Image}}' loro-api > "$pending/api-image.txt"
docker inspect --format '{{.Image}} {{.Config.Image}}' loro-postgres > "$pending/database-image.txt"
docker exec loro-postgres pg_dump -U postgres -d loro -Fc > "$pending/database.dump"
[[ -s $pending/database.dump ]] || { echo 'Database dump is empty.' >&2; exit 1; }
docker exec -i loro-postgres pg_restore --list < "$pending/database.dump" > "$pending/archive-list.txt"
[[ -s $pending/archive-list.txt ]] || { echo 'Database archive has no table of contents.' >&2; exit 1; }
# Read all archive data too: listing alone cannot detect a truncated data section.
docker exec -i loro-postgres pg_restore --file=/dev/null < "$pending/database.dump"
docker exec loro-postgres pg_dump -U postgres -d loro --schema-only > "$pending/schema.sql"
docker exec loro-postgres psql -U postgres -d loro -X -v ON_ERROR_STOP=1 -Atc \
  "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = 'loro'" \
  > "$pending/application-role.txt"
for file in api-image.txt database-image.txt schema.sql application-role.txt; do
  [[ -s $pending/$file ]] || { echo "Missing recovery metadata: $file" >&2; exit 1; }
done
date -u +%Y-%m-%dT%H:%M:%SZ > "$pending/created-at.txt"
cat > "$pending/RESTORE.txt" <<'RESTORE'
This is a local backup, not off-host disaster recovery or a completed restore drill.
Restore only into an isolated PostgreSQL instance with the recorded database image.
Recreate the loro LOGIN role using a recovered secret from the encrypted SOPS source.
Do not copy plaintext passwords into this bundle. application-role.txt records role
attributes; schema.sql and database.dump include ownership and grants, not cluster roles.
Create an empty loro database owned by loro. Run pg_restore as an administrator with
--exit-on-error against that database, retaining ownership and grants. Never restore
over the active database. Verify records, role permissions, readiness and authenticated
tenant isolation using the recorded API image before accepting recovery. Do not start
a newer API image until its migrations and compatibility have been reviewed.
Verify SHA256SUMS after copying this entire directory to separate recovery storage.
RESTORE
(
  cd "$pending"
  sha256sum database.dump schema.sql archive-list.txt api-image.txt database-image.txt \
    application-role.txt created-at.txt RESTORE.txt > SHA256SUMS
  sha256sum --check SHA256SUMS >/dev/null
)
completed="/opt/loro/backups/backup-$(date -u +%Y%m%dT%H%M%SZ)-${pending##*-}"
mv -- "$pending" "$completed"
echo "Verified local backup: $completed (off-host recovery is not configured)."
