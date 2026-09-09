import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const scenario of [
  'success',
  'locked',
  'dump-failure',
  'empty-dump',
  'corrupt-archive',
  'missing-image',
  'missing-role',
  'checksum-failure',
]) {
  test(`EC2 local backup: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loro-backup-'))
    try {
      const script = readFileSync(new URL('./ec2-backup.sh', import.meta.url), 'utf8')
        .replace('/var/lock/loro-api-deploy.lock', `${dir}/lock`)
        .replaceAll('/opt/loro/', `${dir}/`)
      writeFileSync(join(dir, 'backup.sh'), script)
      const command = (name, body) =>
        writeFileSync(join(dir, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 })
      command('id', 'echo 0')
      command('flock', '[[ $SCENARIO != locked ]]')
      // Portable SHA-256 adapter; the host script uses Amazon Linux coreutils.
      command('sha256sum', '[[ $SCENARIO != checksum-failure ]] || exit 1\nexec shasum -a 256 "$@"')
      command(
        'docker',
        `
printf '%s\\n' "$*" >> "$TEST_DIR/calls"
if [[ $1 == inspect ]]; then
  [[ $SCENARIO != missing-image ]] || exit 1
  echo 'sha256:fixture image:fixture'
elif [[ $* == *pg_dump* ]]; then
  [[ $SCENARIO != dump-failure ]] || exit 1
  [[ $SCENARIO == empty-dump ]] || echo 'synthetic dump'
elif [[ $* == *pg_restore* ]]; then
  cat >/dev/null
  if [[ $* == *--file* && $SCENARIO == corrupt-archive ]]; then exit 1; fi
  echo 'synthetic archive listing'
elif [[ $* == *psql* ]]; then
  [[ $SCENARIO == missing-role ]] || echo 'loro|f|f|f|t'
fi
exit 0`,
      )
      const result = spawnSync('bash', [join(dir, 'backup.sh')], {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          TEST_DIR: dir,
          SCENARIO: scenario,
        },
        encoding: 'utf8',
      })
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr)
      if (scenario === 'locked') {
        assert.deepEqual(
          readdirSync(dir).filter((name) => name === 'backups' || name === 'calls'),
          [],
        )
        return
      }
      const backups = readdirSync(join(dir, 'backups'))
      if (scenario !== 'success') {
        assert.deepEqual(backups, [], 'failed or partial backups must not remain complete')
        assert.ok(!result.stdout.includes('Verified local backup'))
        return
      }
      assert.equal(backups.length, 1)
      assert.match(backups[0], /^backup-/)
      const completed = join(dir, 'backups', backups[0])
      assert.equal(statSync(completed).mode & 0o777, 0o700)
      assert.equal(statSync(join(completed, 'database.dump')).mode & 0o777, 0o600)
      assert.equal(
        spawnSync('shasum', ['-a', '256', '--check', 'SHA256SUMS'], { cwd: completed }).status,
        0,
      )
      assert.match(
        readFileSync(join(completed, 'RESTORE.txt'), 'utf8'),
        /Never restore\nover the active database/,
      )
      assert.match(readFileSync(join(dir, 'calls'), 'utf8'), /pg_restore --file=\/dev\/null/)
      writeFileSync(join(completed, 'database.dump'), 'corrupted after transfer')
      assert.notEqual(
        spawnSync('shasum', ['-a', '256', '--check', 'SHA256SUMS'], { cwd: completed }).status,
        0,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
