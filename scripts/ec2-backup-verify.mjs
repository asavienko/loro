#!/usr/bin/env node
/**
 * F-09: verify the integrity and recovery metadata of one copied EC2 backup bundle.
 * This is deliberately an offline check. It does not upload, restore, schedule, or delete.
 */
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const REQUIRED_FILES = new Set([
  'database.dump',
  'schema.sql',
  'archive-list.txt',
  'api-image.txt',
  'database-image.txt',
  'application-role.txt',
  'created-at.txt',
  'RESTORE.txt',
])

function fail(message) {
  throw new Error(`Backup bundle verification failed: ${message}`)
}

async function regularFile(path, name) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${name} must be a regular file`)
  if (stat.mode & 0o077) fail(`${name} must not be readable or writable by group or others`)
  return stat
}

async function main() {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/ec2-backup-verify.mjs /absolute/path/to/backup-*')
    process.exitCode = 2
    return
  }

  const directory = resolve(process.argv[2])
  if (!basename(directory).startsWith('backup-')) fail('directory name must start with backup-')
  const directoryStat = await lstat(directory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
    fail('path must be a directory')
  if (directoryStat.mode & 0o077) fail('directory must not be accessible by group or others')

  const entries = new Set(await readdir(directory))
  for (const name of REQUIRED_FILES) {
    if (!entries.has(name)) fail(`missing ${name}`)
    await regularFile(resolve(directory, name), name)
  }
  if (!entries.has('SHA256SUMS')) fail('missing SHA256SUMS')
  await regularFile(resolve(directory, 'SHA256SUMS'), 'SHA256SUMS')

  const manifest = await readFile(resolve(directory, 'SHA256SUMS'), 'utf8')
  const expected = new Map()
  for (const line of manifest.trim().split('\n')) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line)
    if (!match || !REQUIRED_FILES.has(match[2]) || expected.has(match[2]))
      fail('invalid SHA256SUMS')
    expected.set(match[2], match[1])
  }
  if (expected.size !== REQUIRED_FILES.size)
    fail('SHA256SUMS must cover every required file exactly once')

  for (const name of REQUIRED_FILES) {
    const hash = createHash('sha256')
      .update(await readFile(resolve(directory, name)))
      .digest('hex')
    if (hash !== expected.get(name)) fail(`checksum mismatch for ${name}`)
  }

  const createdAt = (await readFile(resolve(directory, 'created-at.txt'), 'utf8')).trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(createdAt))
    fail('created-at.txt is not UTC ISO-8601')
  for (const name of [
    'api-image.txt',
    'database-image.txt',
    'application-role.txt',
    'schema.sql',
    'archive-list.txt',
  ]) {
    if (!(await readFile(resolve(directory, name), 'utf8')).trim()) fail(`${name} is empty`)
  }
  const restore = await readFile(resolve(directory, 'RESTORE.txt'), 'utf8')
  if (!restore.includes('Never restore\nover the active database'))
    fail('RESTORE.txt lacks active-database safeguard')

  console.log(`Verified backup bundle integrity: ${directory}`)
  console.log(
    'This does not prove off-host retention, PostgreSQL restore, tenant isolation, or recovery acceptance.',
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
