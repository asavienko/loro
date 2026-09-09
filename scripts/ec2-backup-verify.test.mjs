import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const required = {
  'database.dump': 'synthetic custom dump',
  'schema.sql': 'CREATE TABLE synthetic ();',
  'archive-list.txt': 'table synthetic',
  'api-image.txt': 'sha256:api loro-api:fixture',
  'database-image.txt': 'sha256:postgres postgres:fixture',
  'application-role.txt': 'loro|f|f|f|t',
  'created-at.txt': '2026-09-09T12:00:00Z\n',
  'RESTORE.txt': 'Never restore\nover the active database\n',
}

function makeBundle() {
  const root = mkdtempSync(join(tmpdir(), 'loro-backup-verify-'))
  const bundle = join(root, 'backup-fixture')
  mkdirSync(bundle, { mode: 0o700 })
  const manifest = []
  for (const [name, contents] of Object.entries(required)) {
    writeFileSync(join(bundle, name), contents, { mode: 0o600 })
    manifest.push(`${createHash('sha256').update(contents).digest('hex')}  ${name}`)
  }
  writeFileSync(join(bundle, 'SHA256SUMS'), `${manifest.join('\n')}\n`, { mode: 0o600 })
  return { root, bundle }
}

for (const scenario of [
  'success',
  'tampered',
  'unsafe-mode',
  'missing-manifest-entry',
  'bad-restore',
]) {
  test(`EC2 backup verifier: ${scenario}`, () => {
    const { root, bundle } = makeBundle()
    try {
      if (scenario === 'tampered') writeFileSync(join(bundle, 'database.dump'), 'modified')
      if (scenario === 'unsafe-mode') chmodSync(join(bundle, 'schema.sql'), 0o644)
      if (scenario === 'missing-manifest-entry') writeFileSync(join(bundle, 'SHA256SUMS'), '')
      if (scenario === 'bad-restore') {
        const replacement = 'restore somewhere else\n'
        writeFileSync(join(bundle, 'RESTORE.txt'), replacement)
        const lines = readFileSync(join(bundle, 'SHA256SUMS'), 'utf8')
          .split('\n')
          .map((line) =>
            line.endsWith('  RESTORE.txt')
              ? `${createHash('sha256').update(replacement).digest('hex')}  RESTORE.txt`
              : line,
          )
        writeFileSync(join(bundle, 'SHA256SUMS'), lines.join('\n'))
      }
      const result = spawnSync('node', ['scripts/ec2-backup-verify.mjs', bundle], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr)
      if (scenario === 'success') assert.match(result.stdout, /does not prove off-host retention/)
      else assert.match(result.stderr, /Backup bundle verification failed/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
