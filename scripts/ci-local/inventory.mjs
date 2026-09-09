import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
} from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { ROOT, relativePath, isPathInside } from './root.mjs'

// These paths are generated during preparation, then consumed by isolated jobs. Tracked generated
// output stays in the snapshot so the isolated builds exercise the exact checkout state.
const generatedSourceRoots = [
  'apps/mobile/expo-env.d.ts',
  'apps/mobile/.expo/types/router.d.ts',
  'packages/core-rs/pkg',
  'packages/design-tokens/out',
  'packages/core-rs/bindings',
  'packages/core-rs/browser',
]

const excludedSourceDirectories = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'target',
  '.expo',
  'test-results',
  'playwright-report',
  '.ci-local-reports',
  '.local-builds',
  'apps/mobile/android',
  'apps/mobile/ios',
])

const excludedSourceNames = new Set(['dist', 'build', '.expo-export', '.expo-export-web'])
const excludedSourcePrefixes = new Set(['apps/mobile/android', 'apps/mobile/ios'])
const excludedSourceExtensions = new Set([
  '.agekey',
  '.db',
  '.db-journal',
  '.db-shm',
  '.db-wal',
  '.key',
  '.pem',
  '.p8',
  '.p12',
  '.sqlite',
  '.sqlite3',
])

function isSensitiveSourcePath(root, path) {
  const rel = relativePath(root, path)
  if (!rel || rel.startsWith('..')) return false
  const parts = rel.split('/')
  const basename = parts.at(-1) ?? ''
  const isEnvironmentFile =
    (basename.startsWith('.env') || basename.endsWith('.env')) && basename !== '.env.example'
  if (isEnvironmentFile || parts.includes('secrets')) return true
  if (
    excludedSourceExtensions.has(basename) ||
    [...excludedSourceExtensions].some((extension) => basename.endsWith(extension)) ||
    /\.(?:db|sqlite3?)(?:-|$)/.test(basename)
  )
    return true
  if (basename.endsWith('.hprof') || basename.endsWith('.keystore')) return true
  return false
}

function isExcludedSourcePath(root, path) {
  const rel = relativePath(root, path)
  if (!rel || rel.startsWith('..')) return false
  const parts = rel.split('/')
  if (isSensitiveSourcePath(root, path)) return true
  if (
    parts.some((part) => excludedSourceDirectories.has(part)) ||
    [...excludedSourcePrefixes].some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
  )
    return true
  const basename = parts.at(-1) ?? ''
  if (excludedSourceNames.has(basename)) return true
  return false
}

function isGeneratedSourcePath(root, path) {
  const rel = relativePath(root, path)
  return generatedSourceRoots.some(
    (candidate) => rel === candidate || rel.startsWith(`${candidate}/`),
  )
}

function gitSourcePaths(root) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  ).toString('utf8')
  return output.split('\0').filter(Boolean)
}

function statIfPresent(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function filesUnder(root, relativeRoot) {
  const absoluteRoot = join(root, relativeRoot)
  const rootStat = statIfPresent(absoluteRoot)
  if (!rootStat) return []
  if (rootStat.isFile() || rootStat.isSymbolicLink()) return [relativeRoot]
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(relativePath(root, path))
    }
  }
  visit(absoluteRoot)
  return files
}

export function createSourceInventory(root = ROOT) {
  const authoredPaths = new Set()
  const generatedPaths = new Set()
  for (const relativePathName of gitSourcePaths(root)) {
    const absolutePath = join(root, relativePathName)
    if (!statIfPresent(absolutePath)) continue
    if (isSensitiveSourcePath(root, absolutePath)) continue
    if (isGeneratedSourcePath(root, absolutePath)) generatedPaths.add(relativePathName)
    else if (!isExcludedSourcePath(root, absolutePath)) authoredPaths.add(relativePathName)
  }
  for (const generatedRoot of generatedSourceRoots) {
    for (const relativePathName of filesUnder(root, generatedRoot)) {
      const absolutePath = join(root, relativePathName)
      if (isGeneratedSourcePath(root, absolutePath) && !isSensitiveSourcePath(root, absolutePath))
        generatedPaths.add(relativePathName)
    }
  }
  return {
    authoredPaths: [...authoredPaths].sort(),
    generatedPaths: [...generatedPaths].sort(),
  }
}

export function samePaths(left, right) {
  return left.length === right.length && left.every((path, index) => path === right[index])
}

export function fingerprintPaths(root, paths) {
  const hash = createHash('sha256')
  for (const relativePathName of [...paths].sort()) {
    const path = join(root, relativePathName)
    hash.update(`${relativePathName}\0`)
    const stat = statIfPresent(path)
    if (!stat) {
      hash.update('missing\0')
      continue
    }
    if (stat.isSymbolicLink()) hash.update(`link:${readlinkSync(path)}\0`)
    else if (stat.isFile()) hash.update(readFileSync(path))
    else hash.update(`unsupported:${stat.mode}\0`)
  }
  return hash.digest('hex')
}

export function sourceFingerprint(root = ROOT, inventory = createSourceInventory(root)) {
  return fingerprintPaths(root, [...inventory.authoredPaths, ...inventory.generatedPaths])
}

function currentCommit(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
}

export function captureSourceIdentity(root = ROOT) {
  const inventory = createSourceInventory(root)
  return {
    commit: currentCommit(root),
    authoredPaths: inventory.authoredPaths,
    authoredFingerprint: fingerprintPaths(root, inventory.authoredPaths),
  }
}

export function assertSourceIdentity(root, identity, phase) {
  const commit = currentCommit(root)
  if (commit !== identity.commit)
    throw new Error(`Source commit changed during ${phase}: ${identity.commit} -> ${commit}`)
  const current = createSourceInventory(root)
  if (!samePaths(current.authoredPaths, identity.authoredPaths))
    throw new Error(`Authored source inventory changed during ${phase}`)
  const fingerprint = fingerprintPaths(root, identity.authoredPaths)
  if (fingerprint !== identity.authoredFingerprint)
    throw new Error(`Authored source contents changed during ${phase}`)
  return { commit, authoredFingerprint: fingerprint }
}

export function assertGeneratedIdentity(root, paths, fingerprint, phase) {
  const current = createSourceInventory(root)
  if (!samePaths(current.generatedPaths, paths))
    throw new Error(`Generated input inventory changed during ${phase}`)
  const currentFingerprint = fingerprintPaths(root, paths)
  if (currentFingerprint !== fingerprint)
    throw new Error(`Generated inputs changed during ${phase}`)
  return currentFingerprint
}

function assertSafeSymlink(source, sourcePath, inventory) {
  const linkTarget = readlinkSync(sourcePath)
  if (isAbsolute(linkTarget))
    throw new Error(`Refusing absolute symlink: ${relativePath(source, sourcePath)}`)
  const target = resolve(dirname(sourcePath), linkTarget)
  if (!isPathInside(source, target))
    throw new Error(
      `Refusing symlink outside source workspace: ${relativePath(source, sourcePath)}`,
    )
  if (
    !existsSync(target) ||
    (isExcludedSourcePath(source, target) && !isGeneratedSourcePath(source, target))
  )
    throw new Error(
      `Refusing symlink to excluded or missing path: ${relativePath(source, sourcePath)}`,
    )
  const targetRelative = relativePath(source, target)
  if (
    !inventory.has(targetRelative) &&
    ![...inventory].some((listedPath) => listedPath.startsWith(`${targetRelative}/`)) &&
    !isGeneratedSourcePath(source, target)
  )
    throw new Error(`Refusing symlink to unlisted path: ${relativePath(source, sourcePath)}`)
}

export function copySourceWorkspace(
  source,
  destination,
  inventory = createSourceInventory(source),
) {
  mkdirSync(destination, { recursive: true })
  const paths = [...new Set([...inventory.authoredPaths, ...inventory.generatedPaths])].sort()
  const listed = new Set(paths)
  for (const relativePathName of paths) {
    const sourcePath = join(source, relativePathName)
    const sourceStat = statIfPresent(sourcePath)
    if (!sourceStat) throw new Error(`Snapshot source is missing: ${relativePathName}`)
    if (sourceStat.isSymbolicLink()) {
      assertSafeSymlink(source, sourcePath, listed)
      const destinationPath = join(destination, relativePathName)
      mkdirSync(dirname(destinationPath), { recursive: true })
      symlinkSync(readlinkSync(sourcePath), destinationPath)
      continue
    }
    const destinationPath = join(destination, relativePathName)
    mkdirSync(dirname(destinationPath), { recursive: true })
    cpSync(sourcePath, destinationPath, { recursive: true, dereference: false })
  }
}

export function checkGeneratedDrift(root = ROOT) {
  const status = execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--',
      'packages/design-tokens/out',
      'packages/core-rs/bindings',
      'packages/core-rs/browser',
    ],
    { cwd: root, encoding: 'utf8' },
  ).trim()
  if (!status) return { code: 0, status: '' }
  return { code: 1, status }
}
