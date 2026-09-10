/**
 * UniFFI regenerate-and-diff --check. Same fail-closed shape as embed-wasm.mjs --check.
 *
 * Generates Swift/Kotlin into a temp directory, strips trailing whitespace the way
 * build.sh does, and compares against committed bindings/. Skips with an explicit
 * message when libloro_core.{so,dylib} is absent. Fails when the library exists and
 * the generated files differ.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SKIP_MESSAGE =
  'UniFFI --check skipped: libloro_core.{so,dylib} is absent (LORO_SKIP_WASM-style).'

const BINDING_NAMES = new Set(['.swift', '.kt', '.h', '.modulemap'])

export function hostLibraryPath(root) {
  for (const name of ['libloro_core.so', 'libloro_core.dylib']) {
    const file = path.join(root, 'target', 'release', name)
    if (existsSync(file)) return file
  }
  return null
}

/** Same normalize as packages/core-rs/build.sh (`s/[ \\t]+$//`). */
export function normalizeBindingText(text) {
  return text.replace(/[ \t]+$/gm, '')
}

export function listBindingFiles(directory, prefix = '') {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listBindingFiles(full, relative))
    else if (BINDING_NAMES.has(path.extname(entry.name))) files.push(relative)
  }
  return files.sort()
}

export function bindingDrift(generatedRoot, committedRoot) {
  const generated = listBindingFiles(generatedRoot)
  const committed = listBindingFiles(committedRoot)
  const errors = []
  for (const name of committed) {
    if (!generated.includes(name)) {
      errors.push(`Generated UniFFI output missing committed file: ${name}`)
      continue
    }
    const expected = normalizeBindingText(readFileSync(path.join(committedRoot, name), 'utf8'))
    const actual = normalizeBindingText(readFileSync(path.join(generatedRoot, name), 'utf8'))
    if (expected !== actual) errors.push(`UniFFI bindings drifted: ${name}`)
  }
  for (const name of generated) {
    if (!committed.includes(name)) errors.push(`Generated UniFFI file is not committed: ${name}`)
  }
  return errors
}

function generateBindings(root, library, outDir) {
  const result = spawnSync(
    'cargo',
    [
      'run',
      '--quiet',
      '--release',
      '--bin',
      'uniffi-bindgen',
      '--',
      'generate',
      '--library',
      library,
      '--language',
      'swift',
      '--language',
      'kotlin',
      '--out-dir',
      outDir,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(
      `uniffi-bindgen generate failed (${String(result.status)}): ${result.stderr || result.stdout}`,
    )
  }
  for (const name of listBindingFiles(outDir)) {
    const file = path.join(outDir, name)
    writeFileSync(file, normalizeBindingText(readFileSync(file, 'utf8')))
  }
}

export function checkUniffi(root) {
  const library = hostLibraryPath(root)
  if (library === null) return { skipped: true, errors: [] }
  const outDir = mkdtempSync(path.join(tmpdir(), 'loro-uniffi-'))
  try {
    generateBindings(root, library, outDir)
    return { skipped: false, errors: bindingDrift(outDir, path.join(root, 'bindings')) }
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv.includes('--check')) {
    console.error('usage: node scripts/check-uniffi.mjs --check')
    process.exitCode = 1
  } else {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const result = checkUniffi(root)
    if (result.skipped) console.log(SKIP_MESSAGE)
    else if (result.errors.length) {
      console.error(result.errors.join('\n'))
      process.exitCode = 1
    } else console.log('UniFFI bindings match the committed bindings/ tree.')
  }
}
